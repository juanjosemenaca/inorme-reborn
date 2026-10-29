import { describe, expect, it } from "vitest";
import { allowedToolNames, canUseAssistant, checkAiPermission, DASHBOARD_TOOL_MODULES, TOOL_MODULES, type AiPrincipal } from "./permissions.ts";

function principal(partial: Partial<AiPrincipal> & Pick<AiPrincipal, "role">): AiPrincipal {
  return {
    backofficeUserId: "u1",
    authUserId: "a1",
    enabledModules: [],
    companyWorkerId: "w1",
    ...partial,
  };
}

describe("permisos independientes del proveedor", () => {
  it("WORKER sin FACTURACION no puede herramientas de facturación", () => {
    const p = principal({ role: "WORKER", enabledModules: ["GASTOS"] });
    expect(checkAiPermission(p, "get_billing_summary").allowed).toBe(false);
    expect(checkAiPermission(p, "get_expenses_summary").allowed).toBe(true);
  });

  it("ADMIN puede facturación aunque enabled_modules esté vacío", () => {
    const p = principal({ role: "ADMIN" });
    expect(canUseAssistant(p)).toBe(true);
    expect(checkAiPermission(p, "get_billing_summary").allowed).toBe(true);
  });

  it("herramienta desconocida denegada (no hay SQL arbitrario)", () => {
    const p = principal({ role: "ADMIN" });
    expect(checkAiPermission(p, "execute_sql").allowed).toBe(false);
    expect(checkAiPermission(p, "run_query").allowed).toBe(false);
    expect(checkAiPermission(p, "create_dashboard_widget").allowed).toBe(true);
    expect(checkAiPermission(p, "create_dashboard_widget", "dashboard").allowed).toBe(true);
  });

  it("el chat no ofrece herramientas del dashboard y el builder no ofrece SQL ni get_*", () => {
    const p = principal({ role: "ADMIN" });
    expect(allowedToolNames(p, "chat")).toContain("get_billing_summary");
    expect(allowedToolNames(p, "chat")).toContain("get_invoice_list");
    expect(allowedToolNames(p, "chat")).toContain("render_chart");
    expect(allowedToolNames(p, "chat")).toContain("get_data_catalog");
    expect(allowedToolNames(p, "chat")).not.toContain("create_dashboard_widget");
    expect(allowedToolNames(p, "dashboard")).toContain("create_dashboard_widget");
    expect(allowedToolNames(p, "dashboard")).not.toContain("get_billing_summary");
    expect(checkAiPermission(p, "create_dashboard_widget", "chat").allowed).toBe(false);
    expect(checkAiPermission(p, "get_billing_summary", "dashboard").allowed).toBe(false);
  });
});

describe("herramientas independientes del proveedor", () => {
  it("el mapa de permisos no incluye SQL arbitrario", () => {
    expect(Object.keys(TOOL_MODULES)).toContain("get_billing_summary");
    expect(Object.keys(TOOL_MODULES)).toContain("get_invoice_list");
    expect(Object.keys(TOOL_MODULES)).toContain("render_chart");
    expect(Object.keys(TOOL_MODULES)).toContain("get_data_catalog");
    expect(TOOL_MODULES).not.toHaveProperty("execute_sql");
    expect(TOOL_MODULES).not.toHaveProperty("run_query");
    expect(DASHBOARD_TOOL_MODULES).not.toHaveProperty("execute_sql");
    expect(Object.keys(DASHBOARD_TOOL_MODULES)).toContain("create_dashboard_widget");
  });
});
