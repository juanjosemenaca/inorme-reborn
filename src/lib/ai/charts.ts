import { z } from "zod";
import type { AiChart } from "@/types/ai";

export const CHART_COLORS = [
  "#ea580c",
  "#0f766e",
  "#4338ca",
  "#b45309",
  "#0369a1",
  "#7c3aed",
  "#be123c",
  "#57534e",
];

export type PieSlice = {
  label: string;
  value: number;
  pct: number;
  color: string;
};

/** Ordena de mayor a menor y agrupa el resto en «Otros» para que el quesito sea legible. */
export function preparePieSlices(chart: AiChart, maxSlices = 7, othersLabel = "Otros"): { slices: PieSlice[]; total: number } {
  const values = chart.series[0]?.values ?? [];
  const items = chart.categories
    .map((label, i) => ({ label, value: Number(values[i]) || 0 }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = items.reduce((s, x) => s + x.value, 0);
  const shown =
    items.length > maxSlices
      ? [
          ...items.slice(0, maxSlices - 1),
          { label: othersLabel, value: items.slice(maxSlices - 1).reduce((s, x) => s + x.value, 0) },
        ]
      : items;
  return {
    total,
    slices: shown.map((x, i) => ({
      label: x.label,
      value: x.value,
      pct: total ? (x.value / total) * 100 : 0,
      color: i === shown.length - 1 && items.length > maxSlices ? "#78716c" : CHART_COLORS[i % CHART_COLORS.length],
    })),
  };
}

/** Quita títulos duplicados y placeholders del modelo cuando ya hay un gráfico pintado. */
export function chartCompanionText(content: string, charts: AiChart[]): string {
  const titles = new Set(charts.map((c) => c.title.trim().toLowerCase()));
  const cleaned = content
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/<rendered chart>/gi, "")
    .replace(/attachment:\/\/\S+/gi, "");
  const kept = cleaned
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((line) => {
      const plain = line.replace(/^#+\s*/, "").replace(/[*_`]/g, "").trim();
      if (!plain) return false;
      if (titles.has(plain.toLowerCase())) return false;
      if (/^(gr[aá]fico de pastel|quesito|gr[aá]fico tipo|columnas)/i.test(plain)) return false;
      if (/^<render/i.test(plain)) return false;
      return true;
    });
  return kept.join("\n\n").trim();
}

const ChartNumber = z.preprocess((v) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.trim().replace(/\s/g, "").replace(/€/g, "").replace(/%/g, ""));
    return Number.isFinite(n) ? n : v;
  }
  return v;
}, z.number().finite());

const AiChartSchema = z.object({
  type: z.enum(["pie", "column", "bar", "line"]),
  title: z.string().min(1).max(160),
  period: z.string().max(120).optional(),
  unit: z.enum(["eur", "count", "percent"]).optional().default("eur"),
  categories: z.array(z.string().min(1).max(80)).min(1).max(16),
  series: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        values: z.array(ChartNumber).min(1).max(16),
      })
    )
    .min(1)
    .max(4),
});

export function parseAiCharts(raw: unknown): AiChart[] {
  if (!Array.isArray(raw)) return [];
  const out: AiChart[] = [];
  for (const item of raw.slice(0, 3)) {
    const parsed = AiChartSchema.safeParse(item);
    if (!parsed.success) continue;
    const n = parsed.data.categories.length;
    if (parsed.data.series.some((s) => s.values.length !== n)) continue;
    out.push({
      type: parsed.data.type,
      title: parsed.data.title,
      period: parsed.data.period,
      unit: parsed.data.unit,
      categories: parsed.data.categories,
      series: parsed.data.series,
    });
  }
  return out;
}
