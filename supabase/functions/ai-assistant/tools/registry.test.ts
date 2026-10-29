import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { allowedToolNames, checkAiPermission, type AiPrincipal } from "../permissions.ts";

function principal(role: AiPrincipal["role"], modules: AiPrincipal["enabledModules"] = []): AiPrincipal {
  return {
    backofficeUserId: "u1",
    authUserId: "a1",
    role,
    enabledModules: modules,
    companyWorkerId: "w1",
  };
}

describe("registro de tools por intent", () => {
  const registry = readFileSync(resolve(process.cwd(), "supabase/functions/ai-assistant/tools/registry.ts"), "utf8");

  it("getTool exige intent (chat no resuelve tools de dashboard)", () => {
    expect(registry).toMatch(/export function getTool\(name: string, intent: AiIntent = "chat"\)/);
    expect(registry).toContain('if (intent === "dashboard") return DASHBOARD_BY_NAME.get(name)');
    expect(registry).toContain("return DATA_BY_NAME.get(name)");
    const p = principal("ADMIN");
    expect(allowedToolNames(p, "chat")).not.toContain("create_dashboard_widget");
    expect(checkAiPermission(p, "create_dashboard_widget", "chat").allowed).toBe(false);
    expect(getToolDefaultIsChat(registry)).toBe(true);
  });

  it("dashboard no puede ejecutar tools de datos/chat", () => {
    const p = principal("ADMIN");
    expect(allowedToolNames(p, "dashboard")).not.toContain("get_billing_summary");
    expect(checkAiPermission(p, "get_billing_summary", "dashboard").allowed).toBe(false);
    expect(checkAiPermission(p, "create_dashboard_widget", "dashboard").allowed).toBe(true);
  });
});

function getToolDefaultIsChat(src: string): boolean {
  return /getTool\(name: string, intent: AiIntent = "chat"\)/.test(src);
}
