import type { WorkerModuleKey } from "@/types/backoffice";

export const DASHBOARD_WIDGET_TYPES = [
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

export type DashboardWidgetType = (typeof DASHBOARD_WIDGET_TYPES)[number];

export const DASHBOARD_SOURCES = ["billing", "expenses", "projects", "clients"] as const;
export type DashboardSource = (typeof DASHBOARD_SOURCES)[number];

export const DASHBOARD_PERIODS = [
  "current_month",
  "previous_month",
  "last_30_days",
  "last_12_months",
  "current_year",
  "previous_day",
] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export const SOURCE_MODULE: Record<DashboardSource, WorkerModuleKey> = {
  billing: "FACTURACION",
  expenses: "GASTOS",
  projects: "ADMIN_PROJECTS",
  clients: "ADMIN_CLIENTS",
};

export const SOURCE_METRICS: Record<DashboardSource, readonly string[]> = {
  billing: ["total", "invoice_count", "pending_amount", "overdue_count", "collected_total"],
  expenses: ["total", "sheet_count"],
  projects: ["active_count", "ending_soon_count", "without_team_count"],
  clients: ["active_count", "total_count"],
};

export const SOURCE_DATASETS: Record<DashboardSource, readonly string[]> = {
  billing: ["pending_invoices", "top_clients"],
  expenses: ["top_categories"],
  projects: ["ending_soon", "attention"],
  clients: ["active_without_projects"],
};

export type DashboardWidgetConfig = {
  source?: DashboardSource;
  metric?: string;
  dataset?: string;
  period?: DashboardPeriod;
  groupBy?: "day" | "month";
  limit?: number;
  prompt?: string;
  threshold?: number;
};

export type DashboardPosition = { x: number; y: number };

export function defaultSize(type: DashboardWidgetType): { width: number; height: number } {
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
