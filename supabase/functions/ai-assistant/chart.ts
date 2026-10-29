import { z } from "npm:zod@3.23.8";
import type { AIFunctionToolJson } from "./provider/types.ts";

const ChartNumber = z.preprocess((v) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.trim().replace(/\s/g, "").replace(/€/g, "").replace(/%/g, "");
    if (!cleaned) return v;
    const n = Number(cleaned.includes(",") && !cleaned.includes(".") ? cleaned.replace(",", ".") : cleaned);
    return Number.isFinite(n) ? n : v;
  }
  return v;
}, z.number().finite());

function normalizeChartType(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const s = v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (["quesito", "pastel", "tarta", "pie", "donut", "circular"].includes(s)) return "pie";
  if (["columnas", "columna", "column", "barras", "barra", "bar"].includes(s)) return "column";
  if (["linea", "lineas", "line", "evolucion"].includes(s)) return "line";
  return v;
}

const ChartSeriesSchema = z.object({
  name: z.string().trim().min(1).max(60),
  values: z.array(ChartNumber).min(1).max(16),
});

export const AiChartSchema = z
  .object({
    type: z.preprocess(normalizeChartType, z.enum(["pie", "column", "bar", "line"])),
    title: z.string().trim().min(1).max(160),
    period: z.string().trim().max(120).optional(),
    unit: z.enum(["eur", "count", "percent"]).optional().default("eur"),
    categories: z.array(z.string().trim().min(1).max(80)).min(1).max(16),
    series: z.array(ChartSeriesSchema).min(1).max(4),
  })
  .superRefine((v, ctx) => {
    const n = v.categories.length;
    for (let i = 0; i < v.series.length; i++) {
      if (v.series[i].values.length !== n) {
        ctx.addIssue({
          code: "custom",
          message: `series[${i}].values debe tener ${n} valores (uno por categoría).`,
        });
      }
    }
    if (v.type === "pie" && v.series.length > 1) {
      ctx.addIssue({ code: "custom", message: "Un quesito solo admite una serie." });
    }
  });

export type AiChart = z.infer<typeof AiChartSchema>;

export const MAX_CHARTS = 3;

export const RENDER_CHART_TOOL: AIFunctionToolJson = {
  type: "function",
  function: {
    name: "render_chart",
    description:
      "Pinta un gráfico real en el chat (quesito/pastel, columnas/barras o líneas). Úsala cuando el usuario pida un gráfico o comparar visualmente. Primero obtén los datos con otras herramientas y copia aquí esos números; nunca inventes valores. No digas que no puedes generar gráficos ni uses ASCII. Puedes llamarla varias veces (máx. 3) si pide más de un gráfico.",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["pie", "column", "bar", "line"],
          description: "pie = quesito; column/bar = columnas; line = evolución.",
        },
        title: { type: "string", description: "Título del gráfico." },
        period: { type: "string", description: "Período, p. ej. '2026' o 'enero 2025 vs enero 2026'." },
        unit: {
          type: "string",
          enum: ["eur", "count", "percent"],
          description: "Unidad de los valores. eur por defecto.",
        },
        categories: {
          type: "array",
          items: { type: "string" },
          description: "Etiquetas del eje X o del quesito (clientes, meses, indicadores). Máx. 16.",
        },
        series: {
          type: "array",
          description:
            "Una serie para un quesito o un indicador. Varias series para comparar períodos (p. ej. 'Ene 2025' y 'Ene 2026'). Cada values[] alineado con categories.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              values: { type: "array", items: { type: "number" } },
            },
            required: ["name", "values"],
          },
        },
      },
      required: ["type", "title", "categories", "series"],
    },
  },
};
