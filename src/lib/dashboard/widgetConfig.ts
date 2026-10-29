import { z } from "zod";
import {
  DASHBOARD_PERIODS,
  DASHBOARD_SOURCES,
  DASHBOARD_WIDGET_TYPES,
  SOURCE_DATASETS,
  SOURCE_METRICS,
  SOURCE_MODULE,
  type DashboardSource,
  type DashboardWidgetConfig,
  type DashboardWidgetType,
} from "@/lib/dashboard/catalog";
import { canUseAiAssistant } from "@/lib/ai/aiAccess";
import { isWorkerModuleEnabled } from "@/lib/workerModules";
import type { UserRole, WorkerModuleKey } from "@/types/backoffice";

export const WidgetConfigSchema = z.object({
  source: z.enum(DASHBOARD_SOURCES).optional(),
  metric: z.string().max(40).optional(),
  dataset: z.string().max(40).optional(),
  period: z.enum(DASHBOARD_PERIODS).optional(),
  groupBy: z.enum(["day", "month"]).optional(),
  limit: z.number().int().min(1).max(25).optional(),
  prompt: z.string().max(500).optional(),
  threshold: z.number().optional(),
});

export const WidgetTypeSchema = z.enum(DASHBOARD_WIDGET_TYPES);

export type WidgetConfigIssue = { code: string; message: string };

const PositionSchema = z.object({
  x: z.number().int().min(0).max(12),
  y: z.number().int().min(0).max(200),
});

export function validateWidgetLayout(input: {
  title?: string;
  position?: { x: number; y: number };
  width?: number;
  height?: number;
}): WidgetConfigIssue | null {
  if (input.title !== undefined && (input.title.trim().length === 0 || input.title.length > 120)) {
    return { code: "invalid_title", message: "El título debe tener entre 1 y 120 caracteres." };
  }
  if (input.position !== undefined && !PositionSchema.safeParse(input.position).success) {
    return { code: "invalid_position", message: "La posición del widget no es válida." };
  }
  if (input.width !== undefined && (input.width < 1 || input.width > 12)) {
    return { code: "invalid_size", message: "El ancho debe estar entre 1 y 12." };
  }
  if (input.height !== undefined && (input.height < 1 || input.height > 8)) {
    return { code: "invalid_size", message: "La altura debe estar entre 1 y 8." };
  }
  return null;
}

export function validateWidgetConfig(
  type: DashboardWidgetType,
  config: DashboardWidgetConfig,
  role: UserRole,
  enabledModules: readonly WorkerModuleKey[]
): WidgetConfigIssue | null {
  const parsed = WidgetConfigSchema.safeParse(config);
  if (!parsed.success) return { code: "invalid_config", message: "Configuración de widget no válida." };

  const source = parsed.data.source;
  if (type !== "AI_REPORT" && !source) {
    return { code: "source_required", message: "Este widget necesita una fuente de datos conocida." };
  }
  if (source) {
    const needed = SOURCE_MODULE[source];
    if (!dashboardHasModule(role, enabledModules, needed)) {
      return { code: "module_required", message: `No tienes acceso a la fuente «${source}».` };
    }
    if (parsed.data.metric && !SOURCE_METRICS[source].includes(parsed.data.metric)) {
      return { code: "unknown_metric", message: `Métrica no permitida para ${source}.` };
    }
    if (parsed.data.dataset && !SOURCE_DATASETS[source].includes(parsed.data.dataset)) {
      return { code: "unknown_dataset", message: `Dataset no permitido para ${source}.` };
    }
  }
  if (type === "AI_REPORT" && !parsed.data.prompt?.trim()) {
    return { code: "prompt_required", message: "El informe IA necesita una instrucción (prompt)." };
  }
  if ((type === "TABLE" || type === "RANKING") && !parsed.data.dataset) {
    return { code: "dataset_required", message: "La tabla/ranking necesita un dataset conocido." };
  }
  if ((type === "KPI" || type === "KPI_VARIATION" || type === "LINE_CHART" || type === "BAR_CHART" || type === "PIE_CHART" || type === "ALERT") && !parsed.data.metric) {
    return { code: "metric_required", message: "Este widget necesita una métrica conocida." };
  }
  return null;
}

/** Misma regla que el asistente: ADMIN también puede gastos (valida hojas de todos). */
function dashboardHasModule(role: UserRole, enabledModules: readonly WorkerModuleKey[], module: WorkerModuleKey): boolean {
  if (role === "ADMIN" && module === "GASTOS") return true;
  return isWorkerModuleEnabled(role, enabledModules, module);
}

export function canUseSource(
  source: DashboardSource,
  role: UserRole | null | undefined,
  enabledModules: readonly WorkerModuleKey[] | null | undefined
): boolean {
  if (!role) return false;
  return dashboardHasModule(role, enabledModules ?? [], SOURCE_MODULE[source]);
}

export function availableSources(
  role: UserRole | null | undefined,
  enabledModules: readonly WorkerModuleKey[] | null | undefined
): DashboardSource[] {
  return DASHBOARD_SOURCES.filter((s) => canUseSource(s, role, enabledModules));
}

export function canOpenDashboardBuilder(
  role: UserRole | null | undefined,
  enabledModules: readonly WorkerModuleKey[] | null | undefined
): boolean {
  return canUseAiAssistant(role, enabledModules);
}
