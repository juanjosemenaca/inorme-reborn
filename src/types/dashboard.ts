import type { DashboardPosition, DashboardWidgetConfig, DashboardWidgetType } from "@/lib/dashboard/catalog";

export type DashboardWidget = {
  id: string;
  userId: string;
  type: DashboardWidgetType;
  title: string;
  config: DashboardWidgetConfig;
  position: DashboardPosition;
  width: number;
  height: number;
  enabled: boolean;
  reportContent: string | null;
  reportStatus: "idle" | "ready" | "error";
  reportGeneratedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DashboardWidgetRow = {
  id: string;
  user_id: string;
  type: DashboardWidgetType;
  title: string;
  config: DashboardWidgetConfig;
  position: DashboardPosition;
  width: number;
  height: number;
  enabled: boolean;
  report_content: string | null;
  report_status: "idle" | "ready" | "error";
  report_generated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DashboardWidgetInput = {
  type: DashboardWidgetType;
  title: string;
  config: DashboardWidgetConfig;
  position?: DashboardPosition;
  width?: number;
  height?: number;
  enabled?: boolean;
};

export type ChartPoint = { label: string; value: number };
export type TableRow = { cells: string[] };

export type WidgetViewData =
  | { kind: "kpi"; value: number; formatted: string; variation?: string }
  | { kind: "chart"; points: ChartPoint[] }
  | { kind: "table"; columns: string[]; rows: TableRow[] }
  | { kind: "alert"; level: "ok" | "warn"; message: string }
  | { kind: "empty"; message: string };
