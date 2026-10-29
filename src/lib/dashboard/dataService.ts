import { requireSupabase } from "@/api/supabaseRequire";
import { formatEuro } from "@/lib/ai/format";
import type { DashboardWidget } from "@/types/dashboard";
import type { WidgetViewData } from "@/types/dashboard";
import { expenseOwnerFilter, resolveDashboardActor, widgetSourceAccess, type DashboardActor } from "@/lib/dashboard/actor";
import { billingMetric, num, outstanding, seriesFromInvoices, type InvoiceLite } from "@/lib/dashboard/billingMetrics";
import { previousEqualPeriod, resolvePeriod, todayMadridIso } from "@/lib/dashboard/periods";

function pct(prev: number, curr: number): string | undefined {
  if (!prev) return undefined;
  const p = Math.round(((curr - prev) / Math.abs(prev)) * 1000) / 10;
  const sign = p > 0 ? "+" : p < 0 ? "−" : "";
  return `${sign}${Math.abs(p).toFixed(1)} %`;
}

async function loadInvoices(start: string, end: string): Promise<InvoiceLite[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("billing_invoices")
    .select("client_id, status, payment_status, issue_date, due_date, grand_total, collected_total")
    .in("status", ["ISSUED", "PAID"])
    .gte("issue_date", start)
    .lte("issue_date", end)
    .limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []) as InvoiceLite[];
}

/**
 * Datos de widget. El actor se lee de la sesión; un `role` de React no se acepta.
 * `sessionOverride` solo existe para tests.
 */
export async function loadWidgetData(widget: DashboardWidget, sessionOverride?: DashboardActor): Promise<WidgetViewData> {
  const session = sessionOverride ?? (await resolveDashboardActor());
  const today = todayMadridIso();
  const period = resolvePeriod(widget.config.period ?? "current_month", today);
  const metric = widget.config.metric ?? "total";
  const source = widget.config.source;
  const access = widgetSourceAccess(session, source);
  if (access === "unknown_source") return { kind: "empty", message: "Fuente de datos no permitida." };
  if (access === "module_required") return { kind: "empty", message: "No tienes acceso a esta fuente de datos." };

  if (source === "billing") {
    const rows = await loadInvoices(period.start, period.end);
    if (widget.type === "KPI" || widget.type === "KPI_VARIATION") {
      const value = billingMetric(rows, metric, today);
      let variation: string | undefined;
      if (widget.type === "KPI_VARIATION") {
        const prevP = previousEqualPeriod(period.start, period.end);
        const prev = await loadInvoices(prevP.start, prevP.end);
        variation = pct(billingMetric(prev, metric, today), value);
      }
      const formatted = metric.includes("count") ? String(value) : formatEuro(value);
      return { kind: "kpi", value, formatted, variation };
    }
    if (widget.type === "LINE_CHART" || widget.type === "BAR_CHART" || widget.type === "PIE_CHART") {
      const points = seriesFromInvoices(rows, widget.config.groupBy ?? "day", metric, today);
      return { kind: "chart", points };
    }
    if (widget.type === "TABLE" || widget.type === "RANKING") {
      const dataset = widget.config.dataset ?? "top_clients";
      const limit = widget.config.limit ?? 10;
      if (dataset === "pending_invoices") {
        const pending = rows
          .filter((r) => r.payment_status !== "PAID")
          .sort((a, b) => outstanding(b) - outstanding(a))
          .slice(0, limit);
        return {
          kind: "table",
          columns: ["Emisión", "Pendiente"],
          rows: pending.map((r) => ({ cells: [r.issue_date ?? "—", formatEuro(outstanding(r))] })),
        };
      }
      const byClient = new Map<string, number>();
      for (const r of rows) byClient.set(r.client_id, (byClient.get(r.client_id) ?? 0) + num(r.grand_total));
      const top = [...byClient.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
      const sb = requireSupabase();
      const ids = top.map(([id]) => id);
      const { data: clients } = ids.length
        ? await sb.from("clients").select("id, trade_name, company_name").in("id", ids)
        : { data: [] };
      const names = new Map(
        ((clients ?? []) as { id: string; trade_name: string; company_name: string }[]).map((c) => [
          c.id,
          c.trade_name || c.company_name || "Cliente",
        ])
      );
      return {
        kind: "table",
        columns: ["Cliente", "Facturado"],
        rows: top.map(([id, total]) => ({ cells: [names.get(id) ?? "Cliente", formatEuro(total)] })),
      };
    }
    if (widget.type === "ALERT") {
      const overdue = billingMetric(rows, "overdue_count", today);
      if (overdue > 0) return { kind: "alert", level: "warn", message: `${overdue} factura(s) vencida(s) en el período.` };
      return { kind: "alert", level: "ok", message: "No hay facturas vencidas en el período." };
    }
  }

  if (source === "expenses") {
    const scope = expenseOwnerFilter(session);
    if ("none" in scope) return { kind: "empty", message: "No hay ficha de trabajador asociada." };
    const sb = requireSupabase();
    let q = sb
      .from("worker_expense_sheets")
      .select("id, company_worker_id, status, period_start, period_end")
      .in("status", ["SUBMITTED", "APPROVED"])
      .lte("period_start", period.end)
      .gte("period_end", period.start)
      .limit(2000);
    if ("ownerId" in scope) q = q.eq("company_worker_id", scope.ownerId);
    const { data: sheets, error } = await q;
    if (error) throw new Error(error.message);
    const ids = ((sheets ?? []) as { id: string }[]).map((s) => s.id);
    let total = 0;
    const byCat = new Map<string, number>();
    const cats: { col: string; label: string }[] = [
      { col: "amount_tickets", label: "Billetes" },
      { col: "amount_taxis_parking", label: "Taxis" },
      { col: "amount_kms_fuel", label: "Km/combustible" },
      { col: "amount_toll", label: "Peajes" },
      { col: "amount_per_diem", label: "Dietas" },
      { col: "amount_hotel", label: "Hotel" },
      { col: "amount_supplies", label: "Material" },
      { col: "amount_other", label: "Otros" },
    ];
    if (ids.length) {
      const { data: lines, error: lErr } = await sb
        .from("worker_expense_sheet_lines")
        .select(`expense_date, ${cats.map((c) => c.col).join(",")}`)
        .in("sheet_id", ids.slice(0, 1000))
        .gte("expense_date", period.start)
        .lte("expense_date", period.end)
        .limit(5000);
      if (lErr) throw new Error(lErr.message);
      for (const line of lines ?? []) {
        for (const c of cats) {
          const v = num((line as Record<string, unknown>)[c.col]);
          total += v;
          byCat.set(c.label, (byCat.get(c.label) ?? 0) + v);
        }
      }
    }
    if (widget.type === "KPI" || widget.type === "KPI_VARIATION") {
      const value = metric === "sheet_count" ? ids.length : total;
      const formatted = metric === "sheet_count" ? String(value) : formatEuro(value);
      return { kind: "kpi", value, formatted };
    }
    if (widget.config.dataset === "top_categories" || widget.type === "PIE_CHART" || widget.type === "BAR_CHART") {
      const points = [...byCat.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 }));
      if (widget.type === "TABLE" || widget.type === "RANKING") {
        return {
          kind: "table",
          columns: ["Categoría", "Total"],
          rows: points.slice(0, widget.config.limit ?? 8).map((p) => ({ cells: [p.label, formatEuro(p.value)] })),
        };
      }
      return { kind: "chart", points };
    }
    return { kind: "kpi", value: total, formatted: formatEuro(total) };
  }

  if (source === "projects") {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("projects")
      .select("id, project_code, title, start_date, end_date, responsible_company_worker_id")
      .limit(2000);
    if (error) throw new Error(error.message);
    type P = {
      id: string;
      project_code: string;
      title: string;
      start_date: string | null;
      end_date: string | null;
      responsible_company_worker_id: string | null;
    };
    const projects = (data ?? []) as P[];
    const active = projects.filter((p) => {
      if (p.start_date && p.start_date > today) return false;
      if (p.end_date && p.end_date < today) return false;
      return true;
    });
    const soon = active.filter((p) => p.end_date && p.end_date <= new Date(new Date(`${today}T00:00:00Z`).getTime() + 30 * 86400000).toISOString().slice(0, 10));
    const { data: members } = await sb.from("project_members").select("project_id").limit(5000);
    const withTeam = new Set(((members ?? []) as { project_id: string }[]).map((m) => m.project_id));
    const withoutTeam = active.filter((p) => !withTeam.has(p.id)).length;
    if (widget.type === "KPI" || widget.type === "KPI_VARIATION") {
      const value =
        metric === "ending_soon_count" ? soon.length : metric === "without_team_count" ? withoutTeam : active.length;
      return { kind: "kpi", value, formatted: String(value) };
    }
    const list = widget.config.dataset === "attention" ? active.filter((p) => !withTeam.has(p.id) || !p.responsible_company_worker_id) : soon;
    return {
      kind: "table",
      columns: ["Código", "Proyecto", "Fin"],
      rows: list.slice(0, widget.config.limit ?? 10).map((p) => ({ cells: [p.project_code, p.title, p.end_date ?? "—"] })),
    };
  }

  if (source === "clients") {
    const sb = requireSupabase();
    const { data, error } = await sb.from("clients").select("id, trade_name, company_name, active").limit(5000);
    if (error) throw new Error(error.message);
    const clients = (data ?? []) as { id: string; trade_name: string; company_name: string; active: boolean }[];
    const active = clients.filter((c) => c.active);
    if (widget.type === "KPI" || widget.type === "KPI_VARIATION") {
      const value = metric === "total_count" ? clients.length : active.length;
      return { kind: "kpi", value, formatted: String(value) };
    }
    const { data: proj } = await sb.from("projects").select("client_id").limit(5000);
    const withP = new Set(((proj ?? []) as { client_id: string }[]).map((p) => p.client_id));
    const without = active.filter((c) => !withP.has(c.id)).slice(0, widget.config.limit ?? 10);
    return {
      kind: "table",
      columns: ["Cliente"],
      rows: without.map((c) => ({ cells: [c.trade_name || c.company_name || "Cliente"] })),
    };
  }

  return { kind: "empty", message: "Sin datos para este widget." };
}
