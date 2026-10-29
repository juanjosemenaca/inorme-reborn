import { describe, expect, it } from "vitest";
import { aiAvailableAreas, canUseAiAssistant } from "@/lib/ai/aiAccess";

describe("ai/aiAccess", () => {
  it("ADMIN siempre puede usar el asistente y ve todas las áreas", () => {
    expect(canUseAiAssistant("ADMIN", [])).toBe(true);
    expect(aiAvailableAreas("ADMIN", [])).toEqual(["FACTURACION", "GASTOS", "ADMIN_PROJECTS", "ADMIN_CLIENTS"]);
  });

  it("WORKER sin módulos de datos no puede usarlo", () => {
    expect(canUseAiAssistant("WORKER", [])).toBe(false);
    expect(canUseAiAssistant("WORKER", ["VACATIONS", "MESSAGES"])).toBe(false);
    expect(aiAvailableAreas("WORKER", ["VACATIONS"])).toEqual([]);
  });

  it("WORKER con GASTOS solo ve gastos", () => {
    expect(canUseAiAssistant("WORKER", ["GASTOS"])).toBe(true);
    expect(aiAvailableAreas("WORKER", ["GASTOS"])).toEqual(["GASTOS"]);
  });

  it("sin rol no hay acceso", () => {
    expect(canUseAiAssistant(null, ["FACTURACION"])).toBe(false);
    expect(canUseAiAssistant(undefined, undefined)).toBe(false);
    expect(aiAvailableAreas(null, null)).toEqual([]);
  });
});
