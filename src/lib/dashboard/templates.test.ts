import { describe, expect, it } from "vitest";
import { dashboardTemplates } from "@/lib/dashboard/templates";
import { queryKeys } from "@/lib/queryKeys";

describe("dashboard templates y carga", () => {
  it("no sugiere facturación si el usuario no tiene el módulo", () => {
    const tpls = dashboardTemplates("WORKER", ["ADMIN_PROJECTS"]);
    expect(tpls.some((t) => t.id === "finance")).toBe(false);
    expect(tpls.some((t) => t.id === "projects")).toBe(true);
  });

  it("el dashboard invalida widgets por queryKey estable (cambios IA se reflejan)", () => {
    expect(queryKeys.dashboardWidgets).toEqual(["dashboardWidgets"]);
    expect(queryKeys.dashboardWidgetData("abc", "stamp")[0]).toBe("dashboardWidgetData");
  });
});
