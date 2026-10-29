import { z } from "npm:zod@3.23.8";
import type { AIFunctionToolJson } from "./provider/types.ts";

/**
 * Informe estructurado. Mantener alineado con `src/types/ai.ts` (frontend).
 */
export const AiReportSchema = z.object({
  title: z.string().min(1).max(160),
  period: z.string().max(120).optional(),
  summary: z.string().min(1).max(3000),
  kpis: z
    .array(
      z.object({
        label: z.string().min(1).max(80),
        value: z.string().min(1).max(80),
        variation: z.string().max(40).optional(),
      })
    )
    .max(12),
  sections: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        content: z.string().min(1).max(4000),
      })
    )
    .max(10),
  tables: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        columns: z.array(z.string().max(60)).min(1).max(8),
        rows: z.array(z.array(z.string().max(120)).max(8)).max(50),
      })
    )
    .max(6)
    .optional(),
});

export type AiReport = z.infer<typeof AiReportSchema>;

export const RENDER_REPORT_TOOL: AIFunctionToolJson = {
  type: "function",
  function: {
    name: "render_report",
    description:
      "Informe estructurado (título, período, resumen, KPIs, secciones y tablas). Úsala SOLO si el usuario pide un informe, un documento o un resumen para dirección. No la uses para analizar o comparar períodos: en ese caso responde en Markdown. Rellénala solo con datos de otras herramientas; nunca inventes valores.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Título del informe." },
        period: { type: "string", description: "Período analizado, p. ej. 'Septiembre 2026' o '01/09/2026 – 30/09/2026'." },
        summary: { type: "string", description: "Resumen ejecutivo en 2-5 frases." },
        kpis: {
          type: "array",
          description: "Indicadores clave ya formateados (ej. '284.350,00 €').",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              value: { type: "string" },
              variation: { type: "string", description: "Variación respecto al período anterior, ej. '+12,4 %'." },
            },
            required: ["label", "value"],
          },
        },
        sections: {
          type: "array",
          description: "Secciones de análisis. `content` admite Markdown.",
          items: {
            type: "object",
            properties: { title: { type: "string" }, content: { type: "string" } },
            required: ["title", "content"],
          },
        },
        tables: {
          type: "array",
          description: "Tablas de datos (máx. 50 filas, 8 columnas). Celdas como texto ya formateado.",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              columns: { type: "array", items: { type: "string" } },
              rows: { type: "array", items: { type: "array", items: { type: "string" } } },
            },
            required: ["title", "columns", "rows"],
          },
        },
      },
      required: ["title", "summary", "kpis", "sections"],
    },
  },
};

/** Versión Markdown del informe (para historial y como respaldo de render). */
export function reportToMarkdown(r: AiReport): string {
  const out: string[] = [`## ${r.title}`];
  if (r.period) out.push(`*Período: ${r.period}*`);
  out.push("", r.summary, "");
  if (r.kpis.length) {
    for (const k of r.kpis) {
      out.push(`- **${k.label}:** ${k.value}${k.variation ? ` (${k.variation})` : ""}`);
    }
    out.push("");
  }
  for (const s of r.sections) {
    out.push(`### ${s.title}`, "", s.content, "");
  }
  for (const t of r.tables ?? []) {
    out.push(`### ${t.title}`, "");
    out.push(`| ${t.columns.join(" | ")} |`);
    out.push(`| ${t.columns.map(() => "---").join(" | ")} |`);
    for (const row of t.rows) out.push(`| ${row.join(" | ")} |`);
    out.push("");
  }
  return out.join("\n").trim();
}
