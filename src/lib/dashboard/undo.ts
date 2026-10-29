import type { DashboardWidget, DashboardWidgetInput } from "@/types/dashboard";

export type DashboardUndoSnapshot = Array<
  DashboardWidgetInput & { width: number; height: number; position: { x: number; y: number } }
>;

export function snapshotFromWidgets(widgets: DashboardWidget[]): DashboardUndoSnapshot {
  return widgets.map((w) => ({
    type: w.type,
    title: w.title,
    config: w.config,
    position: w.position,
    width: w.width,
    height: w.height,
  }));
}

export function parseUndoSnapshot(raw: unknown): DashboardUndoSnapshot | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: DashboardUndoSnapshot = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const w = item as Record<string, unknown>;
    if (typeof w.type !== "string" || typeof w.title !== "string" || !w.config || typeof w.config !== "object") {
      return null;
    }
    const pos = w.position && typeof w.position === "object" ? (w.position as { x?: number; y?: number }) : { x: 0, y: 0 };
    out.push({
      type: w.type as DashboardWidgetInput["type"],
      title: w.title,
      config: w.config as DashboardWidgetInput["config"],
      position: { x: Number(pos.x) || 0, y: Number(pos.y) || 0 },
      width: Number(w.width) || 4,
      height: Number(w.height) || 2,
    });
  }
  return out;
}
