import { z } from "npm:zod@3.23.8";
import { hasModule, type AiPrincipal, type WorkerModuleKey } from "../permissions.ts";

export const WIDGET_TYPES = [
  "KPI",
  "KPI_VARIATION",
  "LINE_CHART",
  "BAR_CHART",
  "PIE_CHART",
  "TABLE",
  "RANKING",
  "ALERT",
  "AI_REPORT",
] as const;

export const SOURCES = ["billing", "expenses", "projects", "clients"] as const;
export const PERIODS = [
  "current_month",
  "previous_month",
  "last_30_days",
  "last_12_months",
  "current_year",
  "previous_day",
] as const;

export const SOURCE_MODULE: Record<(typeof SOURCES)[number], WorkerModuleKey> = {
  billing: "FACTURACION",
  expenses: "GASTOS",
  projects: "ADMIN_PROJECTS",
  clients: "ADMIN_CLIENTS",
};

export const SOURCE_METRICS: Record<(typeof SOURCES)[number], readonly string[]> = {
  billing: ["total", "invoice_count", "pending_amount", "overdue_count", "collected_total"],
  expenses: ["total", "sheet_count"],
  projects: ["active_count", "ending_soon_count", "without_team_count"],
  clients: ["active_count", "total_count"],
};

export const SOURCE_DATASETS: Record<(typeof SOURCES)[number], readonly string[]> = {
  billing: ["pending_invoices", "top_clients"],
  expenses: ["top_categories"],
  projects: ["ending_soon", "attention"],
  clients: ["active_without_projects"],
};

export const WidgetConfigSchema = z.object({
  source: z.enum(SOURCES).optional(),
  metric: z.string().max(40).optional(),
  dataset: z.string().max(40).optional(),
  period: z.enum(PERIODS).optional(),
  groupBy: z.enum(["day", "month"]).optional(),
  limit: z.number().int().min(1).max(25).optional(),
  prompt: z.string().max(500).optional(),
  threshold: z.number().optional(),
});

export const PositionSchema = z.object({
  x: z.number().int().min(0).max(12),
  y: z.number().int().min(0).max(200),
});

export type WidgetConfig = z.infer<typeof WidgetConfigSchema>;
export type WidgetType = (typeof WIDGET_TYPES)[number];

export function defaultSize(type: WidgetType): { width: number; height: number } {
  switch (type) {
    case "KPI":
    case "KPI_VARIATION":
    case "ALERT":
      return { width: 4, height: 2 };
    case "LINE_CHART":
    case "BAR_CHART":
    case "PIE_CHART":
      return { width: 6, height: 4 };
    case "TABLE":
    case "RANKING":
      return { width: 6, height: 5 };
    case "AI_REPORT":
      return { width: 12, height: 5 };
    default:
      return { width: 4, height: 3 };
  }
}

export function validateWidgetConfig(type: WidgetType, config: WidgetConfig, principal: AiPrincipal): string | null {
  if (type !== "AI_REPORT" && !config.source) return "Este widget necesita una fuente de datos conocida.";
  if (config.source) {
    const needed = SOURCE_MODULE[config.source];
    if (!hasModule(principal, needed)) return `No tienes acceso a la fuente «${config.source}».`;
    if (config.metric && !SOURCE_METRICS[config.source].includes(config.metric)) {
      return `Métrica no permitida para ${config.source}. Permitidas: ${SOURCE_METRICS[config.source].join(", ")}.`;
    }
    if (config.dataset && !SOURCE_DATASETS[config.source].includes(config.dataset)) {
      return `Dataset no permitido para ${config.source}. Permitidos: ${SOURCE_DATASETS[config.source].join(", ")}.`;
    }
  }
  if (type === "AI_REPORT" && !config.prompt?.trim()) return "El informe IA necesita una instrucción (prompt).";
  if ((type === "TABLE" || type === "RANKING") && !config.dataset) return "La tabla/ranking necesita un dataset conocido.";
  if (
    (type === "KPI" ||
      type === "KPI_VARIATION" ||
      type === "LINE_CHART" ||
      type === "BAR_CHART" ||
      type === "PIE_CHART" ||
      type === "ALERT") &&
    !config.metric
  ) {
    return "Este widget necesita una métrica conocida.";
  }
  return null;
}

export function allowedSources(principal: AiPrincipal): (typeof SOURCES)[number][] {
  return SOURCES.filter((s) => hasModule(principal, SOURCE_MODULE[s]));
}
