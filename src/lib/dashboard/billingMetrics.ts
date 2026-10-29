export type InvoiceLite = {
  client_id: string;
  status: string;
  payment_status: string;
  issue_date: string | null;
  due_date: string | null;
  grand_total: string | number;
  collected_total: string | number;
};

export function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function outstanding(r: InvoiceLite): number {
  if (r.payment_status === "PAID") return 0;
  return Math.max(0, num(r.grand_total) - num(r.collected_total));
}

export function billingMetric(rows: InvoiceLite[], metric: string, today: string): number {
  if (metric === "invoice_count") return rows.length;
  if (metric === "pending_amount") return rows.reduce((s, r) => s + outstanding(r), 0);
  if (metric === "overdue_count") {
    return rows.filter((r) => r.payment_status !== "PAID" && r.due_date && r.due_date < today).length;
  }
  if (metric === "collected_total") return rows.reduce((s, r) => s + num(r.collected_total), 0);
  return rows.reduce((s, r) => s + num(r.grand_total), 0);
}

export function seriesFromInvoices(
  rows: InvoiceLite[],
  groupBy: "day" | "month",
  metric: string,
  today: string
): { label: string; value: number }[] {
  const map = new Map<string, InvoiceLite[]>();
  for (const r of rows) {
    const k = groupBy === "month" ? (r.issue_date ?? "").slice(0, 7) : r.issue_date ?? "";
    if (!k) continue;
    const list = map.get(k) ?? [];
    list.push(r);
    map.set(k, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, list]) => ({ label, value: Math.round(billingMetric(list, metric, today) * 100) / 100 }));
}
