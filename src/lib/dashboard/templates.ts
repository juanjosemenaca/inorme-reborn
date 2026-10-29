import { availableSources } from "@/lib/dashboard/widgetConfig";
import type { DashboardWidgetInput } from "@/types/dashboard";
import type { UserRole, WorkerModuleKey } from "@/types/backoffice";

export function dashboardTemplates(
  role: UserRole,
  modules: readonly WorkerModuleKey[]
): { id: string; labelKey: string; widgets: DashboardWidgetInput[] }[] {
  const src = new Set(availableSources(role, modules));
  const out: { id: string; labelKey: string; widgets: DashboardWidgetInput[] }[] = [];

  if (src.has("billing")) {
    out.push({
      id: "finance",
      labelKey: "admin.dashboard.tpl_finance",
      widgets: [
        { type: "KPI", title: "Facturación del mes", config: { source: "billing", metric: "total", period: "current_month" }, position: { x: 0, y: 0 }, width: 4, height: 2 },
        { type: "KPI", title: "Pendiente de cobro", config: { source: "billing", metric: "pending_amount", period: "current_month" }, position: { x: 4, y: 0 }, width: 4, height: 2 },
        { type: "KPI", title: "Facturas vencidas", config: { source: "billing", metric: "overdue_count", period: "current_month" }, position: { x: 8, y: 0 }, width: 4, height: 2 },
        {
          type: "LINE_CHART",
          title: "Facturación últimos 30 días",
          config: { source: "billing", metric: "total", period: "last_30_days", groupBy: "day" },
          position: { x: 0, y: 2 },
          width: 8,
          height: 4,
        },
        {
          type: "RANKING",
          title: "Top clientes",
          config: { source: "billing", dataset: "top_clients", period: "current_month", limit: 10 },
          position: { x: 8, y: 2 },
          width: 4,
          height: 4,
        },
      ],
    });
  }
  if (src.has("projects")) {
    out.push({
      id: "projects",
      labelKey: "admin.dashboard.tpl_projects",
      widgets: [
        { type: "KPI", title: "Proyectos activos", config: { source: "projects", metric: "active_count" }, width: 4, height: 2, position: { x: 0, y: 0 } },
        { type: "KPI", title: "Finalizan en 30 días", config: { source: "projects", metric: "ending_soon_count" }, width: 4, height: 2, position: { x: 4, y: 0 } },
        { type: "TABLE", title: "Proyectos a vigilar", config: { source: "projects", dataset: "attention", limit: 10 }, width: 12, height: 4, position: { x: 0, y: 2 } },
      ],
    });
  }
  if (src.has("expenses")) {
    out.push({
      id: "work",
      labelKey: "admin.dashboard.tpl_work",
      widgets: [
        { type: "KPI", title: "Gastos del mes", config: { source: "expenses", metric: "total", period: "current_month" }, width: 4, height: 2, position: { x: 0, y: 0 } },
        { type: "PIE_CHART", title: "Gastos por categoría", config: { source: "expenses", metric: "total", period: "current_month", dataset: "top_categories" }, width: 8, height: 4, position: { x: 4, y: 0 } },
      ],
    });
  }
  return out;
}
