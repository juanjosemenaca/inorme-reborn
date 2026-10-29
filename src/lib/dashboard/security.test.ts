import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canAttachSchedule, expenseOwnerFilter, widgetSourceAccess, type DashboardActor } from "@/lib/dashboard/actor";
import { AI_REPORT_AUTO_FETCH, buildAiReportMessage, cachedReportFromWidget } from "@/lib/dashboard/aiReport";
import { loadWidgetData } from "@/lib/dashboard/dataService";
import type { DashboardWidget } from "@/types/dashboard";

const worker: DashboardActor = {
  userId: "user-a",
  role: "WORKER",
  modules: ["GASTOS"],
  companyWorkerId: "cw-1",
};

const admin: DashboardActor = {
  userId: "user-admin",
  role: "ADMIN",
  modules: [],
  companyWorkerId: null,
};

function widget(partial: Partial<DashboardWidget> & Pick<DashboardWidget, "type" | "config">): DashboardWidget {
  return {
    id: "w1",
    userId: "user-a",
    title: "Test",
    position: { x: 0, y: 0 },
    width: 4,
    height: 2,
    enabled: true,
    reportContent: null,
    reportStatus: "idle",
    reportGeneratedAt: null,
    createdAt: "2026-10-09T00:00:00Z",
    updatedAt: "2026-10-09T00:00:00Z",
    ...partial,
  };
}

describe("schedule ownership", () => {
  it("usuario A puede crear schedule para widget A", () => {
    expect(canAttachSchedule("user-a", { userId: "user-a" })).toBe(true);
  });

  it("usuario A NO puede crear schedule para widget B", () => {
    expect(canAttachSchedule("user-a", { userId: "user-b" })).toBe(false);
    expect(canAttachSchedule("user-a", null)).toBe(false);
  });
});

describe("fuentes y módulos (sesión, no React)", () => {
  it("usuario sin FACTURACION no ejecuta widget billing", async () => {
    expect(widgetSourceAccess(worker, "billing")).toBe("module_required");
    const data = await loadWidgetData(
      widget({ type: "KPI", config: { source: "billing", metric: "total" } }),
      worker
    );
    expect(data).toEqual({ kind: "empty", message: "No tienes acceso a esta fuente de datos." });
  });

  it("usuario sin módulo correspondiente no usa fuente protegida", () => {
    expect(widgetSourceAccess(worker, "projects")).toBe("module_required");
    expect(widgetSourceAccess(worker, "clients")).toBe("module_required");
    expect(widgetSourceAccess(worker, "expenses")).toBe("ok");
  });

  it("source desconocida (backoffice_users) se deniega", () => {
    expect(widgetSourceAccess(admin, "backoffice_users")).toBe("unknown_source");
  });

  it("modificar role en frontend no otorga permisos de ADMIN", async () => {
    const card = readFileSync(resolve(process.cwd(), "src/components/dashboard/DashboardWidgetCard.tsx"), "utf8");
    const hook = readFileSync(resolve(process.cwd(), "src/hooks/useDashboard.ts"), "utf8");
    const dataSvc = readFileSync(resolve(process.cwd(), "src/lib/dashboard/dataService.ts"), "utf8");
    expect(card).not.toMatch(/useAdminAuth/);
    expect(hook).toMatch(/loadWidgetData\(widget\)/);
    expect(hook).not.toMatch(/role:/);
    expect(dataSvc).toContain("sessionOverride ?? (await resolveDashboardActor())");
    expect(dataSvc).not.toMatch(/ctx\.role|input\.role/);
    const spoofedWidget = widget({ type: "KPI", config: { source: "billing", metric: "total" } });
    const data = await loadWidgetData(spoofedWidget, worker);
    expect(data).toEqual({ kind: "empty", message: "No tienes acceso a esta fuente de datos." });
    expect(expenseOwnerFilter(worker)).toEqual({ ownerId: "cw-1" });
    expect(widgetSourceAccess(worker, "billing")).not.toBe("ok");
  });
});

describe("AI_REPORT cache", () => {
  it("no llama a IA al montar", () => {
    expect(AI_REPORT_AUTO_FETCH).toBe(false);
    const src = readFileSync(resolve(process.cwd(), "src/components/dashboard/AiDashboardReport.tsx"), "utf8");
    expect(src).not.toMatch(/useQuery\(/);
    expect(src).not.toMatch(/enabled:\s*isSupabaseConfigured/);
  });

  it("muestra resultado cacheado", () => {
    const cached = cachedReportFromWidget(
      widget({
        type: "AI_REPORT",
        config: { prompt: "Resume" },
        reportStatus: "ready",
        reportContent: "Informe cacheado",
        reportGeneratedAt: "2026-10-09T08:00:00Z",
      })
    );
    expect(cached).toEqual({ content: "Informe cacheado", generatedAt: "2026-10-09T08:00:00Z" });
  });

  it("Actualizar informe puede generar un nuevo resultado (mensaje + no auto-fetch)", () => {
    const w = widget({ type: "AI_REPORT", config: { prompt: "Resume facturación", period: "current_month" } });
    expect(buildAiReportMessage(w)).toContain("Resume facturación");
    expect(AI_REPORT_AUTO_FETCH).toBe(false);
    const src = readFileSync(resolve(process.cwd(), "src/components/dashboard/AiDashboardReport.tsx"), "utf8");
    expect(src).toContain("sendAiMessage");
    expect(src).toContain("report_refresh");
  });
});
