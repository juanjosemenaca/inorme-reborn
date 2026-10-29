import { describe, expect, it } from "vitest";
import { validateWidgetConfig, validateWidgetLayout, availableSources } from "@/lib/dashboard/widgetConfig";
import { DASHBOARD_SOURCES } from "@/lib/dashboard/catalog";

const billingKpi = {
  source: "billing" as const,
  metric: "total",
  period: "current_month" as const,
};

describe("dashboard widget config", () => {
  it("acepta un KPI de facturación para ADMIN", () => {
    expect(validateWidgetConfig("KPI", billingKpi, "ADMIN", [])).toBeNull();
  });

  it("usuario crea/modifica: WORKER con FACTURACION puede crear widget de facturación", () => {
    expect(validateWidgetConfig("KPI", billingKpi, "WORKER", ["FACTURACION"])).toBeNull();
    expect(
      validateWidgetConfig(
        "LINE_CHART",
        { source: "billing", metric: "total", period: "last_30_days", groupBy: "day" },
        "WORKER",
        ["FACTURACION"]
      )
    ).toBeNull();
  });

  it("WORKER sin FACTURACION no puede crear widget de facturación", () => {
    const issue = validateWidgetConfig("KPI", billingKpi, "WORKER", ["GASTOS"]);
    expect(issue?.code).toBe("module_required");
  });

  it("configuración inválida es rechazada (métrica, dataset, SQL-like)", () => {
    expect(
      validateWidgetConfig("KPI", { source: "billing", metric: "drop_table", period: "current_month" }, "ADMIN", [])?.code
    ).toBe("unknown_metric");
    expect(
      validateWidgetConfig("TABLE", { source: "billing", dataset: "select * from invoices" }, "ADMIN", [])?.code
    ).toBe("unknown_dataset");
    expect(
      validateWidgetConfig(
        "KPI",
        { source: "invented" as never, metric: "total", period: "current_month" },
        "ADMIN",
        []
      )?.code
    ).toBe("invalid_config");
    expect(validateWidgetConfig("KPI", { metric: "total" }, "ADMIN", [])?.code).toBe("source_required");
  });

  it("AI_REPORT exige prompt y no exige métrica", () => {
    expect(validateWidgetConfig("AI_REPORT", { period: "previous_day" }, "ADMIN", [])?.code).toBe("prompt_required");
    expect(
      validateWidgetConfig("AI_REPORT", { prompt: "Resume la facturación", period: "previous_day" }, "ADMIN", [])
    ).toBeNull();
  });

  it("el catálogo de fuentes es cerrado", () => {
    expect([...DASHBOARD_SOURCES]).toEqual(["billing", "expenses", "projects", "clients"]);
    expect(availableSources("WORKER", ["ADMIN_PROJECTS"])).toEqual(["projects"]);
  });

  it("source backoffice_users y JSON inválido se rechazan", () => {
    expect(
      validateWidgetConfig("KPI", { source: "backoffice_users" as never, metric: "total" }, "ADMIN", [])?.code
    ).toBe("invalid_config");
    expect(validateWidgetLayout({ title: "x".repeat(121) })?.code).toBe("invalid_title");
    expect(validateWidgetLayout({ position: { x: -1, y: 0 } })?.code).toBe("invalid_position");
    expect(validateWidgetLayout({ width: 99 })?.code).toBe("invalid_size");
  });

  it("usuario sin módulo de proyectos no puede usar source projects", () => {
    expect(
      validateWidgetConfig("KPI", { source: "projects", metric: "active_count" }, "WORKER", ["GASTOS"])?.code
    ).toBe("module_required");
  });
});
