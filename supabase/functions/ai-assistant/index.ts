import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { z, ZodError } from "npm:zod@3.23.8";
import { todayMadridIso } from "./dates.ts";
import { runAiTurn } from "./orchestrator.ts";
import { allowedToolNames, canUseAssistant, type AiIntent, type AiPrincipal, type UserRole, type WorkerModuleKey } from "./permissions.ts";
import { assertProviderConfigured, loadAiConfig } from "./provider/config.ts";
import { createProvider } from "./provider/createProvider.ts";
import { ProviderError } from "./provider/errors.ts";
import { specFromFunctionJson, type AIMessage } from "./provider/types.ts";
import { buildDashboardSystemPrompt, buildInormeSystemPrompt } from "./prompt.ts";
import { RENDER_CHART_TOOL } from "./chart.ts";
import { RENDER_REPORT_TOOL } from "./report.ts";
import { DASHBOARD_TOOLS, DATA_TOOLS } from "./tools/registry.ts";

// ---------------------------------------------------------------------------
// Configuración y límites
// ---------------------------------------------------------------------------
const MAX_BODY_BYTES = 16 * 1024;
const MAX_MESSAGE_CHARS = 2000;
const HISTORY_MESSAGES = 12;
const MAX_TOOL_ITERATIONS = 6;
const MAX_TOOL_RESULT_CHARS = 8000;
const RATE_LIMIT_WINDOW_MIN = 60;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Mensajes que ve el usuario. Nunca detalles técnicos. */
const USER_MESSAGES: Record<string, string> = {
  unauthorized: "Tu sesión no es válida. Vuelve a iniciar sesión.",
  forbidden: "No tienes permiso para usar el asistente.",
  not_configured: "El asistente no está configurado todavía. Contacta con administración.",
  rate_limited: "Has alcanzado el límite de consultas por hora. Inténtalo más tarde.",
  invalid_request: "La consulta no es válida. Revisa el mensaje e inténtalo de nuevo.",
  message_too_long: `El mensaje es demasiado largo (máximo ${MAX_MESSAGE_CHARS} caracteres).`,
  conversation_not_found: "No se ha encontrado la conversación.",
  openai_timeout: "El análisis ha tardado demasiado. Inténtalo de nuevo con una pregunta más concreta.",
  openai_quota: "La cuenta de OpenAI no tiene saldo. Añade créditos en platform.openai.com para usar el asistente.",
  openai_rate_limited: "Hay demasiadas consultas ahora mismo. Espera un minuto e inténtalo de nuevo.",
  openai_error: "No he podido completar el análisis en este momento. Inténtalo de nuevo.",
  provider_timeout: "El análisis ha tardado demasiado. Inténtalo de nuevo con una pregunta más concreta.",
  provider_quota: "El proveedor de IA no tiene saldo disponible.",
  provider_rate_limited: "Hay demasiadas consultas ahora mismo. Espera un minuto e inténtalo de nuevo.",
  provider_error: "No he podido completar el análisis en este momento. Inténtalo de nuevo.",
  provider_tools_unsupported: "El modelo configurado no admite herramientas. Elige un modelo con tool calling o cambia de proveedor.",
  provider_not_configured: "El asistente no está configurado todavía. Contacta con administración.",
  provider_unknown: "El proveedor de IA configurado no es válido.",
  internal_error: "Se ha producido un error inesperado. Inténtalo de nuevo.",
};

function fail(status: number, code: string): Response {
  return json(status, { error: { code, message: USER_MESSAGES[code] ?? USER_MESSAGES.internal_error } });
}

const RequestSchema = z.object({
  message: z.string().min(1).max(MAX_MESSAGE_CHARS),
  conversationId: z.string().uuid().optional(),
  intent: z.enum(["chat", "dashboard"]).optional().default("chat"),
});

// ---------------------------------------------------------------------------
// Auditoría (service role; nunca lanza)
// ---------------------------------------------------------------------------
type AuditStatus = "ok" | "error" | "denied";

async function audit(
  admin: SupabaseClient,
  row: {
    backoffice_user_id: string | null;
    conversation_id?: string | null;
    action: string;
    tool_name?: string | null;
    status: AuditStatus;
    detail?: Record<string, unknown>;
    duration_ms?: number | null;
  }
): Promise<string | null> {
  try {
    const { data, error } = await admin
      .from("ai_audit_logs")
      .insert({
        backoffice_user_id: row.backoffice_user_id,
        conversation_id: row.conversation_id ?? null,
        action: row.action,
        tool_name: row.tool_name ?? null,
        status: row.status,
        detail: row.detail ?? {},
        duration_ms: row.duration_ms ?? null,
      })
      .select("id")
      .single();
    if (error) {
      console.error("ai_audit_insert_error", error.code, error.message);
      return null;
    }
    return (data as { id: string }).id;
  } catch (e) {
    console.error("ai_audit_insert_exception", e instanceof Error ? e.message : String(e));
    return null;
  }
}

async function auditUpdate(admin: SupabaseClient, id: string | null, patch: Record<string, unknown>): Promise<void> {
  if (!id) return;
  try {
    const { error } = await admin.from("ai_audit_logs").update(patch).eq("id", id);
    if (error) console.error("ai_audit_update_error", error.code, error.message);
  } catch (e) {
    console.error("ai_audit_update_exception", e instanceof Error ? e.message : String(e));
  }
}

async function countRecentRequests(admin: SupabaseClient, userId: string): Promise<number> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60_000).toISOString();
  const { count, error } = await admin
    .from("ai_audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("backoffice_user_id", userId)
    .eq("action", "chat_request")
    .gte("created_at", since);
  if (error) {
    // Si la auditoría falla, cerramos por seguridad (fail-closed).
    console.error("ai_rate_limit_count_error", error.code, error.message);
    return Number.MAX_SAFE_INTEGER;
  }
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function normalizeRole(v: unknown): UserRole | null {
  const r = typeof v === "string" ? v.trim().toUpperCase() : "";
  return r === "ADMIN" ? "ADMIN" : r === "WORKER" ? "WORKER" : null;
}

function normalizeModules(v: unknown): WorkerModuleKey[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is WorkerModuleKey => typeof x === "string");
}

function titleFromMessage(msg: string): string {
  const t = msg.replace(/\s+/g, " ").trim();
  return t.length > 80 ? `${t.slice(0, 77)}…` : t;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: { code: "method_not_allowed", message: "Método no permitido." } });

  const startedAt = Date.now();

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const aiConfig = loadAiConfig({
    AI_PROVIDER: Deno.env.get("AI_PROVIDER"),
    AI_TIMEOUT_MS: Deno.env.get("AI_TIMEOUT_MS"),
    AI_MAX_TOKENS: Deno.env.get("AI_MAX_TOKENS"),
    OPENAI_API_KEY: Deno.env.get("OPENAI_API_KEY"),
    OPENAI_MODEL: Deno.env.get("OPENAI_MODEL"),
    OLLAMA_BASE_URL: Deno.env.get("OLLAMA_BASE_URL"),
    OLLAMA_MODEL: Deno.env.get("OLLAMA_MODEL"),
    OLLAMA_API_KEY: Deno.env.get("OLLAMA_API_KEY"),
  });
  const rateLimitPerHour = Number(Deno.env.get("AI_RATE_LIMIT_PER_HOUR") || "30") || 30;

  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error("ai_assistant_missing_supabase_env");
    return fail(500, "internal_error");
  }

  // 1) Sesión
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return fail(401, "unauthorized");

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: authData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !authData.user) return fail(401, "unauthorized");

  const admin = createClient(supabaseUrl, serviceKey);

  // 2) Perfil real (nunca del cuerpo de la petición)
  const { data: profile, error: profileErr } = await admin
    .from("backoffice_users")
    .select("id, role, active, enabled_modules, company_worker_id")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();
  if (profileErr) {
    console.error("ai_profile_error", profileErr.code, profileErr.message);
    return fail(500, "internal_error");
  }
  const role = normalizeRole(profile?.role);
  if (!profile || profile.active !== true || !role) {
    await audit(admin, { backoffice_user_id: profile?.id ?? null, action: "access_denied", status: "denied", detail: { reason: "inactive_or_missing" } });
    return fail(403, "forbidden");
  }
  const principal: AiPrincipal = {
    backofficeUserId: profile.id as string,
    authUserId: authData.user.id,
    role,
    enabledModules: normalizeModules(profile.enabled_modules),
    companyWorkerId: (profile.company_worker_id as string | null) ?? null,
  };

  // 3) Acceso al asistente
  if (!canUseAssistant(principal)) {
    await audit(admin, { backoffice_user_id: principal.backofficeUserId, action: "access_denied", status: "denied", detail: { reason: "no_data_modules" } });
    return fail(403, "forbidden");
  }

  try {
    assertProviderConfigured(aiConfig);
  } catch (e) {
    if (e instanceof ProviderError) {
      console.error("ai_assistant_provider_not_configured", aiConfig.provider);
      return fail(500, "not_configured");
    }
    throw e;
  }

  // 4) Cuerpo
  const rawText = await req.text();
  if (rawText.length > MAX_BODY_BYTES) return fail(413, "message_too_long");
  let parsed: z.infer<typeof RequestSchema>;
  try {
    parsed = RequestSchema.parse(JSON.parse(rawText));
  } catch (e) {
    if (e instanceof ZodError && e.issues.some((i) => i.code === "too_big")) return fail(400, "message_too_long");
    return fail(400, "invalid_request");
  }

  // 5) Rate limit (fail-closed)
  const recent = await countRecentRequests(admin, principal.backofficeUserId);
  if (recent >= rateLimitPerHour) {
    await audit(admin, { backoffice_user_id: principal.backofficeUserId, action: "rate_limited", status: "denied", detail: { recent, limit: rateLimitPerHour } });
    return fail(429, "rate_limited");
  }
  const requestAuditId = await audit(admin, {
    backoffice_user_id: principal.backofficeUserId,
    action: "chat_request",
    status: "ok",
    detail: { message_chars: parsed.message.length, provider: aiConfig.provider, model: aiConfig.provider === "openai" ? aiConfig.openai.model : aiConfig.provider === "ollama" ? aiConfig.ollama.model : "mock" },
  });

  // 6) Conversación (cliente del usuario → RLS garantiza propiedad)
  let conversationId = parsed.conversationId ?? null;
  if (conversationId) {
    const { data: conv, error: convErr } = await userClient
      .from("ai_conversations")
      .select("id")
      .eq("id", conversationId)
      .maybeSingle();
    if (convErr) {
      console.error("ai_conversation_select_error", convErr.code, convErr.message);
      return fail(500, "internal_error");
    }
    if (!conv) return fail(404, "conversation_not_found");
  } else {
    const { data: created, error: createErr } = await userClient
      .from("ai_conversations")
      .insert({ user_id: principal.backofficeUserId, title: titleFromMessage(parsed.message) })
      .select("id")
      .single();
    if (createErr || !created) {
      console.error("ai_conversation_insert_error", createErr?.code, createErr?.message);
      return fail(500, "internal_error");
    }
    conversationId = (created as { id: string }).id;
  }
  await auditUpdate(admin, requestAuditId, { conversation_id: conversationId });

  const { data: historyRows, error: histErr } = await userClient
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_MESSAGES);
  if (histErr) {
    console.error("ai_history_error", histErr.code, histErr.message);
    return fail(500, "internal_error");
  }
  const history = ((historyRows ?? []) as { role: "user" | "assistant"; content: string }[]).reverse();

  const { error: userMsgErr } = await userClient
    .from("ai_messages")
    .insert({ conversation_id: conversationId, role: "user", content: parsed.message });
  if (userMsgErr) {
    console.error("ai_user_message_insert_error", userMsgErr.code, userMsgErr.message);
    return fail(500, "internal_error");
  }

  // 7) Orquestador (proveedor agnóstico + herramientas de Inorme)
  const today = todayMadridIso();
  const intent: AiIntent = parsed.intent ?? "chat";
  const allowed = new Set(allowedToolNames(principal, intent));
  const pool = intent === "dashboard" ? DASHBOARD_TOOLS : DATA_TOOLS;
  const dataTools = pool.filter((t) => {
    const n = "function" in t.definition ? t.definition.function.name : t.definition.name;
    return allowed.has(n);
  });
  let dashboardWidgetsJson = "[]";
  if (intent === "dashboard") {
    const { data: wrows } = await userClient
      .from("dashboard_widgets")
      .select("id, type, title, config, position, width, height")
      .eq("enabled", true)
      .order("created_at", { ascending: true });
    dashboardWidgetsJson = JSON.stringify(wrows ?? []);
  }
  const systemContent =
    intent === "dashboard"
      ? buildDashboardSystemPrompt(principal, today, dashboardWidgetsJson)
      : buildInormeSystemPrompt(principal, today);
  const extraSpecs =
    intent === "dashboard" ? [] : [specFromFunctionJson(RENDER_REPORT_TOOL), specFromFunctionJson(RENDER_CHART_TOOL)];
  const messages: AIMessage[] = [
    { role: "system", content: systemContent },
    ...history.map((h) => ({ role: h.role, content: h.content }) as AIMessage),
    { role: "user", content: parsed.message },
  ];

  const provider = createProvider(aiConfig);
  const modelLabel = provider.model;
  let toolsUsed: string[] = [];
  let report: Awaited<ReturnType<typeof runAiTurn>>["report"] = null;
  let charts: Awaited<ReturnType<typeof runAiTurn>>["charts"] = [];
  let reply: string | null = null;
  let iterations = 0;
  let totalTokens = 0;
  let errorCode: string | null = null;

  try {
    const turn = await runAiTurn({
      provider,
      principal,
      intent,
      messages,
      tools: dataTools,
      extraSpecs,
      ctx: { principal, db: userClient, today },
      maxIterations: MAX_TOOL_ITERATIONS,
      maxToolResultChars: MAX_TOOL_RESULT_CHARS,
      audit: {
        tool: async (row) => {
          await audit(admin, {
            backoffice_user_id: principal.backofficeUserId,
            conversation_id: conversationId,
            action: "tool_call",
            tool_name: row.name,
            status: row.status,
            detail: row.detail,
            duration_ms: row.duration_ms,
          });
        },
      },
    });
    reply = turn.reply;
    report = turn.report;
    charts = turn.charts;
    toolsUsed = turn.toolsUsed;
    iterations = turn.iterations;
    totalTokens = turn.usage.total_tokens ?? 0;
    if (turn.reply.startsWith("No he podido completar el análisis con las iteraciones")) errorCode = "max_iterations";
  } catch (e) {
    if (e instanceof ProviderError) {
      errorCode = USER_MESSAGES[e.code] ? e.code : "provider_error";
      await audit(admin, {
        backoffice_user_id: principal.backofficeUserId,
        conversation_id: conversationId,
        action: "provider_error",
        status: "error",
        detail: { provider: e.provider, status: e.status, code: e.code },
      });
      await auditUpdate(admin, requestAuditId, {
        status: "error",
        duration_ms: Date.now() - startedAt,
        detail: { error: errorCode, provider: provider.name, model: modelLabel, tools: toolsUsed, iterations },
      });
      return fail(502, errorCode);
    }
    console.error("ai_assistant_unexpected", e instanceof Error ? e.message : String(e));
    await auditUpdate(admin, requestAuditId, { status: "error", duration_ms: Date.now() - startedAt, detail: { error: "internal_error" } });
    return fail(500, "internal_error");
  }

  // 8) Persistencia y respuesta
  const { error: asstErr } = await userClient.from("ai_messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: reply,
    metadata: { report, charts, tools_used: toolsUsed, provider: provider.name, model: modelLabel, total_tokens: totalTokens },
  });
  if (asstErr) console.error("ai_assistant_message_insert_error", asstErr.code, asstErr.message);
  await userClient.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);

  await auditUpdate(admin, requestAuditId, {
    status: errorCode ? "error" : "ok",
    duration_ms: Date.now() - startedAt,
    detail: {
      tools: toolsUsed,
      iterations,
      total_tokens: totalTokens,
      has_report: !!report,
      chart_count: charts.length,
      error: errorCode,
      provider: provider.name,
      model: modelLabel,
    },
  });

  return json(200, { conversationId, reply, report, charts, toolsUsed });
});
