import { requireSupabase } from "@/api/supabaseRequire";
import { parseAiCharts } from "@/lib/ai/charts";
import type {
  AiChatResponse,
  AiConversation,
  AiConversationRow,
  AiMessageModel,
  AiMessageRow,
} from "@/types/ai";

/** Error con mensaje apto para mostrar al usuario (viene saneado del servidor). */
export class AiAssistantError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const GENERIC_MESSAGE = "No he podido completar la consulta. Inténtalo de nuevo.";

type ErrorPayload = { error?: { code?: string; message?: string } };

/**
 * Solo desarrollo: redirige el asistente a una función local (127.0.0.1 / localhost).
 * No es una URL de Ollama ni un secreto de proveedor. En producción esta env no debe existir.
 */
function localAssistantUrl(): string | null {
  const raw = import.meta.env.VITE_AI_ASSISTANT_FUNCTION_URL as string | undefined;
  if (!raw?.trim()) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.hostname !== "127.0.0.1" && u.hostname !== "localhost") return null;
    return `${u.origin}${u.pathname}`.replace(/\/+$/, "") || `${u.origin}`;
  } catch {
    return null;
  }
}

/**
 * Envía un mensaje a la Edge Function `ai-assistant`.
 * El servidor decide permisos con la sesión; aquí solo viajan el texto y la conversación.
 */
export async function sendAiMessage(input: {
  message: string;
  conversationId?: string | null;
  intent?: "chat" | "dashboard";
}): Promise<AiChatResponse> {
  const sb = requireSupabase();
  const body = {
    message: input.message,
    conversationId: input.conversationId ?? undefined,
    intent: input.intent ?? "chat",
  };
  const localUrl = localAssistantUrl();
  if (localUrl) {
    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new AiAssistantError("unauthorized", "Tu sesión no es válida. Vuelve a iniciar sesión.");
    const res = await fetch(localUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let payload: (AiChatResponse & ErrorPayload) | null = null;
    try {
      payload = (await res.json()) as AiChatResponse & ErrorPayload;
    } catch {
      throw new AiAssistantError("network", GENERIC_MESSAGE);
    }
    if (!res.ok || !payload || payload.error) {
      throw new AiAssistantError(payload?.error?.code ?? "error", payload?.error?.message ?? GENERIC_MESSAGE);
    }
    return {
      conversationId: payload.conversationId,
      reply: payload.reply ?? "",
      report: payload.report ?? null,
      charts: parseAiCharts(payload.charts),
      toolsUsed: Array.isArray(payload.toolsUsed) ? payload.toolsUsed : [],
    };
  }
  const { data, error } = await sb.functions.invoke("ai-assistant", { body });

  if (error) {
    // supabase-js adjunta la respuesta HTTP en `context` para FunctionsHttpError.
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const payload = (await ctx.json()) as ErrorPayload;
        if (payload?.error?.message) {
          throw new AiAssistantError(payload.error.code ?? "error", payload.error.message);
        }
      } catch (e) {
        if (e instanceof AiAssistantError) throw e;
      }
    }
    const fromData = (data as ErrorPayload | null)?.error;
    if (fromData?.message) throw new AiAssistantError(fromData.code ?? "error", fromData.message);
    throw new AiAssistantError("network", GENERIC_MESSAGE);
  }

  const payload = data as (AiChatResponse & ErrorPayload) | null;
  if (!payload || payload.error) {
    throw new AiAssistantError(payload?.error?.code ?? "error", payload?.error?.message ?? GENERIC_MESSAGE);
  }
  return {
    conversationId: payload.conversationId,
    reply: payload.reply ?? "",
    report: payload.report ?? null,
    charts: parseAiCharts(payload.charts),
    toolsUsed: Array.isArray(payload.toolsUsed) ? payload.toolsUsed : [],
  };
}

export async function fetchAiConversations(): Promise<AiConversation[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("ai_conversations")
    .select("id, user_id, title, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return ((data ?? []) as AiConversationRow[]).map((r) => ({
    id: r.id,
    title: r.title || "Conversación",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function fetchAiMessages(conversationId: string): Promise<AiMessageModel[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("ai_messages")
    .select("id, conversation_id, role, content, metadata, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return ((data ?? []) as AiMessageRow[]).map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    createdAt: r.created_at,
    report: r.metadata?.report ?? null,
    charts: parseAiCharts(r.metadata?.charts),
    toolsUsed: r.metadata?.tools_used ?? [],
  }));
}

export async function deleteAiConversation(conversationId: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("ai_conversations").delete().eq("id", conversationId);
  if (error) throw error;
}
