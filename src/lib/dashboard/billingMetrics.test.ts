import { describe, expect, it } from "vitest";
import { billingMetric, outstanding, seriesFromInvoices, type InvoiceLite } from "@/lib/dashboard/billingMetrics";

const rows: InvoiceLite[] = [
  {
    client_id: "c1",
    status: "ISSUED",
    payment_status: "UNPAID",
    issue_date: "2026-10-01",
    due_date: "2026-10-02",
    grand_total: 100,
    collected_total: 20,
  },
  {
    client_id: "c1",
    status: "PAID",
    payment_status: "PAID",
    issue_date: "2026-10-02",
    due_date: "2026-10-10",
    grand_total: 50,
    collected_total: 50,
  },
];

describe("dashboard billing metrics", () => {
  it("calcula totales, pendiente y vencidas con las mismas reglas de Inorme", () => {
    expect(outstanding(rows[0])).toBe(80);
    expect(outstanding(rows[1])).toBe(0);
    expect(billingMetric(rows, "total", "2026-10-08")).toBe(150);
    expect(billingMetric(rows, "pending_amount", "2026-10-08")).toBe(80);
    expect(billingMetric(rows, "overdue_count", "2026-10-08")).toBe(1);
    expect(billingMetric(rows, "invoice_count", "2026-10-08")).toBe(2);
  });

  it("agrupa series diarias sin SQL libre", () => {
    const series = seriesFromInvoices(rows, "day", "total", "2026-10-08");
    expect(series).toEqual([
      { label: "2026-10-01", value: 100 },
      { label: "2026-10-02", value: 50 },
    ]);
  });
});
