import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DASHBOARD_SOURCES,
  DASHBOARD_WIDGET_TYPES,
  SOURCE_DATASETS,
  SOURCE_METRICS,
  SOURCE_MODULE,
} from "@/lib/dashboard/catalog";

function block(src: string, name: string): string {
  const re = new RegExp(`export const ${name}[\\s\\S]*?= ([\\s\\S]*?);`);
  const m = src.match(re);
  if (!m) throw new Error(`No se encontró ${name}`);
  return m[1].replace(/\s+/g, " ").trim();
}

describe("catálogo frontend / Edge Function", () => {
  const edge = readFileSync(resolve(process.cwd(), "supabase/functions/ai-assistant/tools/dashboardCatalog.ts"), "utf8");

  it("fuentes, tipos, métricas y módulos coinciden", () => {
    expect(block(edge, "SOURCES")).toContain("billing");
    expect(block(edge, "SOURCES")).toContain("expenses");
    expect(block(edge, "SOURCES")).toContain("projects");
    expect(block(edge, "SOURCES")).toContain("clients");
    for (const t of DASHBOARD_WIDGET_TYPES) expect(block(edge, "WIDGET_TYPES")).toContain(`"${t}"`);
    for (const s of DASHBOARD_SOURCES) expect(block(edge, "SOURCES")).toContain(`"${s}"`);
    expect(block(edge, "SOURCE_MODULE")).toContain('billing: "FACTURACION"');
    expect(block(edge, "SOURCE_MODULE")).toContain('expenses: "GASTOS"');
    expect(block(edge, "SOURCE_MODULE")).toContain('projects: "ADMIN_PROJECTS"');
    expect(block(edge, "SOURCE_MODULE")).toContain('clients: "ADMIN_CLIENTS"');
    expect(SOURCE_MODULE.billing).toBe("FACTURACION");
    expect(SOURCE_METRICS.billing).toEqual(["total", "invoice_count", "pending_amount", "overdue_count", "collected_total"]);
    expect(SOURCE_DATASETS.billing).toEqual(["pending_invoices", "top_clients"]);
    expect(block(edge, "SOURCE_METRICS")).toContain("pending_amount");
    expect(block(edge, "SOURCE_DATASETS")).toContain("top_clients");
  });
});
