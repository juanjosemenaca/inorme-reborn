import { ZodError } from "npm:zod@3.23.8";
import { checkAiPermission, type AiIntent, type AiPrincipal } from "./permissions.ts";
import { ProviderError } from "./provider/errors.ts";
import type { AIMessage, AIProvider, AIToolCall, AIToolSpec, AIUsage } from "./provider/types.ts";
import { isFunctionToolJson, specFromFunctionJson } from "./provider/types.ts";
import { AiChartSchema, MAX_CHARTS, type AiChart } from "./chart.ts";
import { AiReportSchema, reportToMarkdown, type AiReport } from "./report.ts";
import { getTool } from "./tools/registry.ts";
import type { AiTool, ToolContext } from "./tools/types.ts";
import { ToolError } from "./tools/types.ts";

export type OrchestratorAudit = {
  tool: (row: {
    name: string;
    status: "ok" | "error" | "denied";
    detail?: Record<string, unknown>;
    duration_ms?: number;
  }) => Promise<void>;
};

export type RunTurnInput = {
  provider: AIProvider;
  principal: AiPrincipal;
  /** Sin intent, el registro trata las tools como `chat` (no dashboard). */
  intent: AiIntent;
  messages: AIMessage[];
  tools: AiTool[];
  extraSpecs: AIToolSpec[];
  ctx: ToolContext;
  maxIterations: number;
  maxToolResultChars: number;
  audit: OrchestratorAudit;
};

export type RunTurnResult = {
  reply: string;
  report: AiReport | null;
  charts: AiChart[];
  toolsUsed: string[];
  iterations: number;
  usage: AIUsage;
};

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}\n…[resultado truncado]`;
}

function stripFakeChartMarkdown(text: string): string {
  return text.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

export function specOf(tool: AiTool): AIToolSpec {
  const d = tool.definition;
  if (isFunctionToolJson(d)) return specFromFunctionJson(d);
  return d as AIToolSpec;
}

function dateErrorMessage(code: string): string {
  return (
    {
      invalid_date_format: "Formato de fecha no válido (usa YYYY-MM-DD).",
      start_after_end: "La fecha inicial es posterior a la final.",
      date_too_old: "La fecha es anterior al año 2000.",
      range_too_wide: "El rango supera el máximo de 2 años.",
    }[code] ?? "Fecha no válida."
  );
}

/**
 * Bucle modelo ↔ herramientas. Independiente del chatbot HTTP y del proveedor.
 * Los permisos se vuelven a comprobar en cada tool (defensa en profundidad).
 * No hay SQL libre: solo `getTool` + `run`.
 */
export async function runAiTurn(input: RunTurnInput): Promise<RunTurnResult> {
  const { provider, principal, ctx, maxIterations, maxToolResultChars, audit } = input;
  const byName = new Map(input.tools.map((t) => [specOf(t).name, t]));
  const specs: AIToolSpec[] = [...input.tools.map(specOf), ...input.extraSpecs];
  const messages = [...input.messages];

  if (specs.length && !(await provider.supportsToolCalling())) {
    throw new ProviderError("provider_tools_unsupported", 400, provider.name);
  }

  const toolsUsed: string[] = [];
  let report: AiReport | null = null;
  const charts: AiChart[] = [];
  let chartNudgeSent = false;
  let reply: string | null = null;
  let iterations = 0;
  let finalizeWithoutTools = false;
  const usage: AIUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  const addUsage = (u?: AIUsage) => {
    if (!u) return;
    usage.prompt_tokens = (usage.prompt_tokens ?? 0) + (u.prompt_tokens ?? 0);
    usage.completion_tokens = (usage.completion_tokens ?? 0) + (u.completion_tokens ?? 0);
    usage.total_tokens = (usage.total_tokens ?? 0) + (u.total_tokens ?? 0);
  };

  const pushTool = (call: AIToolCall, content: string) => {
    messages.push({ role: "tool", tool_call_id: call.id, name: call.name, content });
  };

  for (; iterations < maxIterations; iterations++) {
    const completion = await provider.chat({
      messages,
      tools: finalizeWithoutTools ? [] : specs,
      think: false,
    });
    addUsage(completion.usage);
    const calls = finalizeWithoutTools ? [] : (completion.tool_calls ?? []);

    if (calls.length === 0) {
      const text = (completion.content ?? "").trim();
      if (text) {
        const fakeChart = /no puedo generar|no puede generar|representaci[oó]n textual|ascii|\+---/i.test(text);
        if (fakeChart && charts.length === 0 && !chartNudgeSent && toolsUsed.length > 0) {
          chartNudgeSent = true;
          messages.push({ role: "assistant", content: text });
          messages.push({
            role: "user",
            content:
              "No uses ASCII ni digas que no puedes generar gráficos. Llama a render_chart con type pie, column o line y los números exactos de las herramientas.",
          });
          continue;
        }
        reply = charts.length ? stripFakeChartMarkdown(text) || "Gráfico generado a partir de los datos de Inorme." : text;
        break;
      }
      if (charts.length > 0) {
        reply = "Gráfico generado a partir de los datos de Inorme.";
        break;
      }
      const wantsChart = messages.some(
        (m) => m.role === "user" && /gr[aá]fico|quesito|pastel|tarta|columnas|barras|l[ií]neas|diagrama/i.test(m.content)
      );
      if (!finalizeWithoutTools && wantsChart && toolsUsed.length > 0 && !chartNudgeSent) {
        chartNudgeSent = true;
        messages.push({
          role: "user",
          content:
            "El usuario pidió un gráfico. Llama ahora a render_chart con type pie, column o line y los números exactos de las herramientas. No uses ASCII.",
        });
        continue;
      }
      if (!finalizeWithoutTools && toolsUsed.length > 0) {
        finalizeWithoutTools = true;
        messages.push({
          role: "user",
          content:
            "Responde ahora al usuario en español con Markdown, usando únicamente los datos de las herramientas. No llames a más herramientas ni a render_report.",
        });
        continue;
      }
      reply = "No he obtenido una respuesta. Inténtalo de nuevo.";
      break;
    }

    messages.push({ role: "assistant", content: completion.content ?? null, tool_calls: calls });

    let reportDelivered = false;
    for (const call of calls) {
      const name = call.name;
      const t0 = Date.now();
      const args = call.arguments ?? {};

      if (name === "render_chart") {
        if (charts.length >= MAX_CHARTS) {
          pushTool(call, JSON.stringify({ error: `Máximo ${MAX_CHARTS} gráficos por respuesta.` }));
          await audit.tool({ name, status: "error", detail: { code: "too_many_charts" } });
          continue;
        }
        const check = AiChartSchema.safeParse(args);
        if (!check.success) {
          const issues = check.error.issues
            .slice(0, 8)
            .map((i) => `${i.path.join(".") || "gráfico"}: ${i.message}`)
            .join("; ");
          pushTool(call, JSON.stringify({ error: `Gráfico no válido (${issues}). Corrige type, categories y series.` }));
          await audit.tool({ name, status: "error", detail: { code: "invalid_chart" } });
          continue;
        }
        charts.push(check.data);
        toolsUsed.push(name);
        pushTool(call, JSON.stringify({ ok: true, charts: charts.length }));
        await audit.tool({ name, status: "ok", duration_ms: Date.now() - t0 });
        continue;
      }

      if (name === "render_report") {
        const check = AiReportSchema.safeParse(args);
        if (!check.success) {
          const issues = check.error.issues
            .slice(0, 8)
            .map((i) => `${i.path.join(".") || "informe"}: ${i.message}`)
            .join("; ");
          pushTool(
            call,
            JSON.stringify({
              error: `Informe no válido (${issues}). Corrige esos campos o responde en Markdown sin render_report.`,
            })
          );
          await audit.tool({ name, status: "error", detail: { code: "invalid_report" } });
          continue;
        }
        report = check.data;
        toolsUsed.push(name);
        reportDelivered = true;
        pushTool(call, JSON.stringify({ ok: true }));
        await audit.tool({ name, status: "ok", duration_ms: Date.now() - t0 });
        continue;
      }

      const perm = checkAiPermission(principal, name, input.intent);
      if (!perm.allowed) {
        pushTool(call, JSON.stringify({ error: "El usuario no tiene permiso para consultar estos datos." }));
        await audit.tool({ name, status: "denied", detail: { reason: perm.reason } });
        continue;
      }
      if (!getTool(name, input.intent) || !byName.has(name)) {
        pushTool(call, JSON.stringify({ error: "Herramienta desconocida." }));
        continue;
      }
      const tool = byName.get(name)!;
      try {
        const result = await tool.run(ctx, args);
        toolsUsed.push(name);
        pushTool(call, truncate(JSON.stringify(result), maxToolResultChars));
        await audit.tool({ name, status: "ok", detail: { args }, duration_ms: Date.now() - t0 });
      } catch (e) {
        let code = "tool_error";
        let userMsg = "No se han podido consultar los datos. Inténtalo de nuevo.";
        if (e instanceof ToolError) {
          code = e.code;
          userMsg = e.message;
        } else if (e instanceof ZodError) {
          code = "invalid_args";
          userMsg = "Parámetros no válidos: " + e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        } else if (e instanceof Error && ["invalid_date_format", "start_after_end", "date_too_old", "range_too_wide"].includes(e.message)) {
          code = e.message;
          userMsg = dateErrorMessage(e.message);
        } else {
          console.error("ai_tool_unexpected_error", name, e instanceof Error ? e.message : String(e));
        }
        pushTool(call, JSON.stringify({ error: userMsg }));
        await audit.tool({ name, status: "error", detail: { code, args }, duration_ms: Date.now() - t0 });
      }
    }

    if (reportDelivered && report) {
      reply = reportToMarkdown(report);
      break;
    }
  }

  if (reply === null) {
    reply = charts.length
      ? "Gráfico generado a partir de los datos de Inorme."
      : "No he podido completar el análisis con las iteraciones disponibles. Prueba a acotar la pregunta (por ejemplo, un único período).";
  }

  return { reply, report, charts, toolsUsed, iterations, usage };
}
