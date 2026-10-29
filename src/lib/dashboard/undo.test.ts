import { describe, expect, it } from "vitest";
import { parseUndoSnapshot, snapshotFromWidgets } from "@/lib/dashboard/undo";
import type { DashboardWidget } from "@/types/dashboard";

const widget = {
  id: "w1",
  userId: "u1",
  type: "KPI",
  title: "Facturación del mes",
  config: { source: "billing", metric: "total", period: "current_month" },
  position: { x: 0, y: 0 },
  width: 4,
  height: 2,
  enabled: true,
  reportContent: null,
  reportStatus: "idle",
  reportGeneratedAt: null,
  createdAt: "2026-10-08T00:00:00Z",
  updatedAt: "2026-10-08T00:00:00Z",
} as DashboardWidget;

describe("dashboard undo snapshot", () => {
  it("deshacer restaura la configuración anterior", () => {
    const snap = snapshotFromWidgets([widget]);
    const restored = parseUndoSnapshot(snap);
    expect(restored).toEqual([
      {
        type: "KPI",
        title: "Facturación del mes",
        config: { source: "billing", metric: "total", period: "current_month" },
        position: { x: 0, y: 0 },
        width: 4,
        height: 2,
      },
    ]);
    expect(parseUndoSnapshot(null)).toBeNull();
    expect(parseUndoSnapshot([])).toBeNull();
  });
});
