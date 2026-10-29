import type { AiReport } from "@/types/ai";

const EUR = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `12345.6` → `12.345,60 €`. */
export function formatEuro(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return EUR.format(value);
}

/** `12.345` → `+12,3 %`; `null` → `—`. */
export function formatPercent(value: number | null | undefined, withSign = true): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
    Math.abs(value)
  );
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${withSign ? sign : ""}${abs} %`;
}

/** `2026-09-30` o ISO completo → `30/09/2026`. Devuelve `—` si no es fecha. */
export function formatDateEs(value: string | null | undefined): string {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Hora corta `HH:mm` para timestamps de mensajes. */
export function formatTimeEs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Versión Markdown de un informe (para copiar / respaldo de render).
 * Misma estructura que `reportToMarkdown` en la Edge Function.
 */
export function reportToMarkdown(r: AiReport): string {
  const out: string[] = [`## ${r.title}`];
  if (r.period) out.push(`*Período: ${r.period}*`);
  out.push("", r.summary, "");
  if (r.kpis.length) {
    for (const k of r.kpis) out.push(`- **${k.label}:** ${k.value}${k.variation ? ` (${k.variation})` : ""}`);
    out.push("");
  }
  for (const s of r.sections) out.push(`### ${s.title}`, "", s.content, "");
  for (const t of r.tables ?? []) {
    out.push(`### ${t.title}`, "");
    out.push(`| ${t.columns.join(" | ")} |`);
    out.push(`| ${t.columns.map(() => "---").join(" | ")} |`);
    for (const row of t.rows) out.push(`| ${row.join(" | ")} |`);
    out.push("");
  }
  return out.join("\n").trim();
}

/** Signo de una variación textual (`+12,4 %` → `up`), para colorear KPIs. */
export function variationTrend(variation: string | undefined): "up" | "down" | "flat" {
  if (!variation) return "flat";
  const v = variation.trim();
  if (v.startsWith("+")) return "up";
  if (v.startsWith("-") || v.startsWith("−")) return "down";
  return "flat";
}
