import { z } from "npm:zod@3.23.8";
import { previousPeriod, percentChange, round2, validatePeriod, daysBetween, type Period } from "../dates.ts";
import { DATE_PARAM, MAX_ROWS, ToolError, dbFail, num, type AiTool, type ToolContext } from "./types.ts";
import { sanitizeInvoiceListInput } from "./invoiceListSanitize.ts";

/** Facturas que cuentan como facturación real (ni borradores ni anuladas). */
const COUNTED_STATUSES = ["ISSUED", "PAID"] as const;

type InvoiceRow = {
  id: string;
  series_id: string;
  fiscal_year: number | null;
  invoice_number: number | null;
  status: string;
  payment_status: string;
  invoice_kind: string;
  issue_date: string | null;
  due_date: string | null;
  client_id: string;
  notes: string | null;
  taxable_base_total: string | number;
  grand_total: string | number;
  collected_total: string | number;
};

const INVOICE_COLUMNS =
  "id, series_id, fiscal_year, invoice_number, status, payment_status, invoice_kind, issue_date, due_date, client_id, notes, taxable_base_total, grand_total, collected_total";

const LIST_NOTES_MAX = 240;

function clipNotes(raw: string | null | undefined): string {
  const t = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length <= LIST_NOTES_MAX ? t : `${t.slice(0, LIST_NOTES_MAX - 1)}…`;
}

async function fetchCountedInvoices(ctx: ToolContext, period: Period | null): Promise<InvoiceRow[]> {
  let q = ctx.db
    .from("billing_invoices")
    .select(INVOICE_COLUMNS)
    .in("status", [...COUNTED_STATUSES])
    .order("issue_date", { ascending: true })
    .limit(MAX_ROWS);
  if (period) q = q.gte("issue_date", period.start).lte("issue_date", period.end);
  const { data, error } = await q;
  if (error) dbFail("billing_invoices", error);
  return (data ?? []) as InvoiceRow[];
}

async function countDrafts(ctx: ToolContext, period: Period): Promise<number> {
  const { count, error } = await ctx.db
    .from("billing_invoices")
    .select("id", { count: "exact", head: true })
    .eq("status", "DRAFT")
    .gte("issue_date", period.start)
    .lte("issue_date", period.end);
  if (error) dbFail("billing_invoices_drafts", error);
  return count ?? 0;
}

async function clientNames(ctx: ToolContext, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const { data, error } = await ctx.db
    .from("clients")
    .select("id, trade_name, company_name")
    .in("id", ids.slice(0, 500));
  if (error) dbFail("clients", error);
  for (const c of (data ?? []) as { id: string; trade_name: string; company_name: string }[]) {
    map.set(c.id, (c.trade_name || c.company_name || "").trim() || "Cliente sin nombre");
  }
  return map;
}

async function seriesCodes(ctx: ToolContext, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const { data, error } = await ctx.db.from("billing_series").select("id, code").in("id", ids.slice(0, 100));
  if (error) dbFail("billing_series", error);
  for (const s of (data ?? []) as { id: string; code: string }[]) map.set(s.id, s.code);
  return map;
}

function outstanding(inv: InvoiceRow): number {
  if (inv.payment_status === "PAID") return 0;
  return Math.max(0, num(inv.grand_total) - num(inv.collected_total));
}

function isOverdue(inv: InvoiceRow, today: string): boolean {
  return inv.payment_status !== "PAID" && !!inv.due_date && inv.due_date < today;
}

function summarize(rows: InvoiceRow[], today: string) {
  let invoiced = 0;
  let taxable = 0;
  let collected = 0;
  let pendingAmount = 0;
  let pendingCount = 0;
  let overdueAmount = 0;
  let overdueCount = 0;
  let rectificative = 0;
  for (const r of rows) {
    invoiced += num(r.grand_total);
    taxable += num(r.taxable_base_total);
    collected += num(r.collected_total);
    if (r.invoice_kind === "RECTIFICATIVE") rectificative += 1;
    const o = outstanding(r);
    if (r.payment_status !== "PAID") {
      pendingCount += 1;
      pendingAmount += o;
    }
    if (isOverdue(r, today)) {
      overdueCount += 1;
      overdueAmount += o;
    }
  }
  return {
    invoice_count: rows.length,
    rectificative_count: rectificative,
    invoiced_total: round2(invoiced),
    taxable_base_total: round2(taxable),
    collected_total: round2(collected),
    pending_count: pendingCount,
    pending_amount: round2(pendingAmount),
    overdue_count: overdueCount,
    overdue_amount: round2(overdueAmount),
  };
}

function compareSummaries(prev: ReturnType<typeof summarize>, curr: ReturnType<typeof summarize>) {
  return {
    invoiced_total_diff: round2(curr.invoiced_total - prev.invoiced_total),
    invoiced_total_pct: percentChange(prev.invoiced_total, curr.invoiced_total),
    invoice_count_diff: curr.invoice_count - prev.invoice_count,
    invoice_count_pct: percentChange(prev.invoice_count, curr.invoice_count),
    collected_total_diff: round2(curr.collected_total - prev.collected_total),
    collected_total_pct: percentChange(prev.collected_total, curr.collected_total),
    pending_amount_diff: round2(curr.pending_amount - prev.pending_amount),
  };
}

function invoiceRef(inv: InvoiceRow, codes: Map<string, string>): string {
  const code = codes.get(inv.series_id) ?? "";
  if (inv.invoice_number == null) return `${code} (sin número)`.trim();
  return `${code}${code ? "-" : ""}${inv.fiscal_year ?? ""}-${String(inv.invoice_number).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------

const SummaryArgs = z.object({
  start_date: z.string(),
  end_date: z.string(),
  compare_previous_period: z.boolean().optional().default(false),
});

export const getBillingSummary: AiTool = {
  definition: {
    type: "function",
    function: {
      name: "get_billing_summary",
      description:
        "Resumen de facturación de un período: total facturado, base imponible, nº de facturas, pendientes y vencidas (nº e importe), cobrado y borradores. Opcionalmente compara con el período anterior de igual duración.",
      parameters: {
        type: "object",
        properties: {
          start_date: DATE_PARAM,
          end_date: DATE_PARAM,
          compare_previous_period: { type: "boolean", description: "Si true, añade el período anterior y variaciones." },
        },
        required: ["start_date", "end_date"],
      },
    },
  },
  async run(ctx, raw) {
    const args = SummaryArgs.parse(raw);
    const period = validatePeriod(args.start_date, args.end_date);
    const rows = await fetchCountedInvoices(ctx, period);
    const current = summarize(rows, ctx.today);
    const drafts = await countDrafts(ctx, period);
    const out: Record<string, unknown> = {
      period,
      current: { ...current, draft_count_not_included: drafts },
      note: "Totales con IVA (grand_total). Solo facturas emitidas/pagadas; los borradores se indican aparte.",
    };
    if (args.compare_previous_period) {
      const prevP = previousPeriod(period);
      const prevRows = await fetchCountedInvoices(ctx, prevP);
      const prev = summarize(prevRows, ctx.today);
      out.previous = { period: prevP, ...prev };
      out.comparison = compareSummaries(prev, current);
    }
    return out;
  },
};

// ---------------------------------------------------------------------------

const TopClientsArgs = z.object({
  start_date: z.string(),
  end_date: z.string(),
  limit: z.number().int().min(1).max(25).optional().default(10),
});

export const getTopClientsByBilling: AiTool = {
  definition: {
    type: "function",
    function: {
      name: "get_top_clients_by_billing",
      description: "Principales clientes por facturación en un período, con nº de facturas, total y cuota sobre el total.",
      parameters: {
        type: "object",
        properties: {
          start_date: DATE_PARAM,
          end_date: DATE_PARAM,
          limit: { type: "integer", minimum: 1, maximum: 25, description: "Nº de clientes (por defecto 10)." },
        },
        required: ["start_date", "end_date"],
      },
    },
  },
  async run(ctx, raw) {
    const args = TopClientsArgs.parse(raw);
    const period = validatePeriod(args.start_date, args.end_date);
    const rows = await fetchCountedInvoices(ctx, period);
    const byClient = new Map<string, { total: number; count: number; pending: number }>();
    let grand = 0;
    for (const r of rows) {
      const e = byClient.get(r.client_id) ?? { total: 0, count: 0, pending: 0 };
      e.total += num(r.grand_total);
      e.count += 1;
      e.pending += outstanding(r);
      grand += num(r.grand_total);
      byClient.set(r.client_id, e);
    }
    const sorted = [...byClient.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, args.limit);
    const names = await clientNames(ctx, sorted.map(([id]) => id));
    return {
      period,
      total_invoiced: round2(grand),
      clients_with_invoices: byClient.size,
      top: sorted.map(([id, e], i) => ({
        rank: i + 1,
        client: names.get(id) ?? "Cliente desconocido",
        invoice_count: e.count,
        invoiced_total: round2(e.total),
        pending_amount: round2(e.pending),
        share_pct: grand ? round2((e.total / grand) * 100) : null,
      })),
    };
  },
};

// ---------------------------------------------------------------------------

const PendingArgs = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  overdue_only: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(50).optional().default(25),
});

export const getPendingInvoices: AiTool = {
  definition: {
    type: "function",
    function: {
      name: "get_pending_invoices",
      description:
        "Facturas pendientes de cobro (y vencidas) con referencia, cliente, fechas, importe, cobrado, pendiente y días de retraso. Sin fechas devuelve todas las pendientes.",
      parameters: {
        type: "object",
        properties: {
          start_date: { ...DATE_PARAM, description: "Opcional. Fecha de emisión mínima." },
          end_date: { ...DATE_PARAM, description: "Opcional. Fecha de emisión máxima." },
          overdue_only: { type: "boolean", description: "Solo vencidas (fecha de vencimiento anterior a hoy)." },
          limit: { type: "integer", minimum: 1, maximum: 50 },
        },
        required: [],
      },
    },
  },
  async run(ctx, raw) {
    const args = PendingArgs.parse(raw);
    let period: Period | null = null;
    if (args.start_date || args.end_date) {
      if (!args.start_date || !args.end_date) throw new ToolError("invalid_period", "Indica fecha inicial y final.");
      period = validatePeriod(args.start_date, args.end_date);
    }
    const rows = (await fetchCountedInvoices(ctx, period)).filter((r) => r.payment_status !== "PAID");
    const filtered = args.overdue_only ? rows.filter((r) => isOverdue(r, ctx.today)) : rows;
    const totalOutstanding = round2(filtered.reduce((s, r) => s + outstanding(r), 0));
    const overdueRows = filtered.filter((r) => isOverdue(r, ctx.today));
    const sorted = [...filtered].sort((a, b) => outstanding(b) - outstanding(a)).slice(0, args.limit);
    const [names, codes] = await Promise.all([
      clientNames(ctx, [...new Set(sorted.map((r) => r.client_id))]),
      seriesCodes(ctx, [...new Set(sorted.map((r) => r.series_id))]),
    ]);
    return {
      period,
      overdue_only: args.overdue_only,
      pending_count: filtered.length,
      pending_amount: totalOutstanding,
      overdue_count: overdueRows.length,
      overdue_amount: round2(overdueRows.reduce((s, r) => s + outstanding(r), 0)),
      invoices_without_due_date: filtered.filter((r) => !r.due_date).length,
      shown: sorted.length,
      invoices: sorted.map((r) => ({
        reference: invoiceRef(r, codes),
        client: names.get(r.client_id) ?? "Cliente desconocido",
        issue_date: r.issue_date,
        due_date: r.due_date,
        grand_total: round2(num(r.grand_total)),
        collected_total: round2(num(r.collected_total)),
        outstanding: round2(outstanding(r)),
        payment_status: r.payment_status,
        days_overdue: r.due_date && r.due_date < ctx.today ? daysBetween(r.due_date, ctx.today) : 0,
      })),
    };
  },
};

// ---------------------------------------------------------------------------

const ComparisonArgs = z.object({
  period_a_start: z.string(),
  period_a_end: z.string(),
  period_b_start: z.string(),
  period_b_end: z.string(),
});

export const getBillingComparison: AiTool = {
  definition: {
    type: "function",
    function: {
      name: "get_billing_comparison",
      description:
        "Compara la facturación de dos períodos (A anterior, B posterior): totales, nº de facturas, cobrado, pendiente, diferencias absolutas y porcentuales, y evolución mensual.",
      parameters: {
        type: "object",
        properties: {
          period_a_start: DATE_PARAM,
          period_a_end: DATE_PARAM,
          period_b_start: DATE_PARAM,
          period_b_end: DATE_PARAM,
        },
        required: ["period_a_start", "period_a_end", "period_b_start", "period_b_end"],
      },
    },
  },
  async run(ctx, raw) {
    const args = ComparisonArgs.parse(raw);
    const a = validatePeriod(args.period_a_start, args.period_a_end);
    const b = validatePeriod(args.period_b_start, args.period_b_end);
    const [rowsA, rowsB] = await Promise.all([fetchCountedInvoices(ctx, a), fetchCountedInvoices(ctx, b)]);
    const sa = summarize(rowsA, ctx.today);
    const sb = summarize(rowsB, ctx.today);
    const monthly = (rows: InvoiceRow[]) => {
      const m = new Map<string, { total: number; count: number }>();
      for (const r of rows) {
        const k = (r.issue_date ?? "").slice(0, 7);
        const e = m.get(k) ?? { total: 0, count: 0 };
        e.total += num(r.grand_total);
        e.count += 1;
        m.set(k, e);
      }
      return [...m.entries()]
        .sort(([x], [y]) => x.localeCompare(y))
        .map(([month, e]) => ({ month, invoiced_total: round2(e.total), invoice_count: e.count }));
    };
    return {
      period_a: { ...a, ...sa, monthly: monthly(rowsA) },
      period_b: { ...b, ...sb, monthly: monthly(rowsB) },
      comparison: compareSummaries(sa, sb),
    };
  },
};

// ---------------------------------------------------------------------------

const ClientComparisonArgs = z.object({
  period_a_start: z.string(),
  period_a_end: z.string(),
  period_b_start: z.string(),
  period_b_end: z.string(),
  direction: z.enum(["increase", "decrease", "all"]).optional().default("all"),
  limit: z.number().int().min(1).max(25).optional().default(10),
});

export const getClientBillingComparison: AiTool = {
  definition: {
    type: "function",
    function: {
      name: "get_client_billing_comparison",
      description:
        "Detecta clientes cuya facturación ha aumentado o disminuido entre dos períodos (A anterior, B posterior), con totales por período, diferencia absoluta y porcentual.",
      parameters: {
        type: "object",
        properties: {
          period_a_start: DATE_PARAM,
          period_a_end: DATE_PARAM,
          period_b_start: DATE_PARAM,
          period_b_end: DATE_PARAM,
          direction: {
            type: "string",
            enum: ["increase", "decrease", "all"],
            description: "Filtrar por clientes que suben, bajan o todos (ordenados por mayor variación absoluta).",
          },
          limit: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["period_a_start", "period_a_end", "period_b_start", "period_b_end"],
      },
    },
  },
  async run(ctx, raw) {
    const args = ClientComparisonArgs.parse(raw);
    const a = validatePeriod(args.period_a_start, args.period_a_end);
    const b = validatePeriod(args.period_b_start, args.period_b_end);
    const [rowsA, rowsB] = await Promise.all([fetchCountedInvoices(ctx, a), fetchCountedInvoices(ctx, b)]);
    const acc = new Map<string, { a: number; b: number; ca: number; cb: number }>();
    for (const r of rowsA) {
      const e = acc.get(r.client_id) ?? { a: 0, b: 0, ca: 0, cb: 0 };
      e.a += num(r.grand_total);
      e.ca += 1;
      acc.set(r.client_id, e);
    }
    for (const r of rowsB) {
      const e = acc.get(r.client_id) ?? { a: 0, b: 0, ca: 0, cb: 0 };
      e.b += num(r.grand_total);
      e.cb += 1;
      acc.set(r.client_id, e);
    }
    let list = [...acc.entries()].map(([id, e]) => ({
      id,
      total_a: round2(e.a),
      total_b: round2(e.b),
      invoices_a: e.ca,
      invoices_b: e.cb,
      diff: round2(e.b - e.a),
      pct: percentChange(e.a, e.b),
    }));
    if (args.direction === "increase") list = list.filter((x) => x.diff > 0);
    if (args.direction === "decrease") list = list.filter((x) => x.diff < 0);
    list.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
    const shown = list.slice(0, args.limit);
    const names = await clientNames(ctx, shown.map((x) => x.id));
    return {
      period_a: a,
      period_b: b,
      clients_total: acc.size,
      increased: list.filter((x) => x.diff > 0).length,
      decreased: list.filter((x) => x.diff < 0).length,
      unchanged: list.filter((x) => x.diff === 0).length,
      clients: shown.map(({ id, ...rest }) => ({ client: names.get(id) ?? "Cliente desconocido", ...rest })),
    };
  },
};

const emptyToUndef = (v: unknown) => (v === "" || v === null ? undefined : v);
const optNum = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }
  return v;
}, z.number().min(0).optional());

const InvoiceListArgs = z.preprocess(
  sanitizeInvoiceListInput,
  z
    .object({
      start_date: z.string(),
      end_date: z.string(),
      client_query: z.preprocess(emptyToUndef, z.string().trim().max(80).optional()),
      min_amount: optNum,
      max_amount: optNum,
      min_quantity: optNum,
      max_quantity: optNum,
      payment: z.preprocess(emptyToUndef, z.enum(["all", "pending", "paid"]).optional().default("all")),
      order_by: z.preprocess(emptyToUndef, z.enum(["issue_date", "amount", "client"]).optional().default("issue_date")),
      order: z.preprocess(emptyToUndef, z.enum(["asc", "desc"]).optional().default("asc")),
      limit: z.preprocess(emptyToUndef, z.number().int().min(1).max(100).optional().default(50)),
    })
    .superRefine((v, ctx) => {
      if (v.min_amount != null && v.max_amount != null && v.min_amount > v.max_amount) {
        ctx.addIssue({ code: "custom", message: "min_amount no puede ser mayor que max_amount." });
      }
      if (v.min_quantity != null && v.max_quantity != null && v.min_quantity > v.max_quantity) {
        ctx.addIssue({ code: "custom", message: "min_quantity no puede ser mayor que max_quantity." });
      }
    })
);

async function billableQtyByInvoice(ctx: ToolContext, invoiceIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (invoiceIds.length === 0) return map;
  const { data, error } = await ctx.db
    .from("billing_invoice_lines")
    .select("invoice_id, quantity, line_type")
    .in("invoice_id", invoiceIds.slice(0, MAX_ROWS))
    .limit(MAX_ROWS);
  if (error) dbFail("billing_invoice_lines", error);
  for (const row of (data ?? []) as { invoice_id: string; quantity: string | number; line_type: string }[]) {
    if (row.line_type && row.line_type !== "BILLABLE") continue;
    map.set(row.invoice_id, (map.get(row.invoice_id) ?? 0) + num(row.quantity));
  }
  return map;
}

export const getInvoiceList: AiTool = {
  definition: {
    type: "function",
    function: {
      name: "get_invoice_list",
      description:
        "Listado de facturas emitidas/pagadas. Combina en una sola llamada los filtros que el usuario pida: fechas, cliente, importe, cantidad y cobro. Omite cualquier filtro que no haya pedido; no envíes 0 ni cadenas vacías. Columnas: número, comentario, fecha, cliente, importe y cantidad. Hay un máximo de filas; no es un volcado completo.",
      parameters: {
        type: "object",
        properties: {
          start_date: DATE_PARAM,
          end_date: DATE_PARAM,
          client_query: {
            type: "string",
            description: "Texto a buscar en el nombre del cliente. Omítelo si no filtra por cliente.",
          },
          min_amount: { type: "number", description: "Importe mínimo (IVA incluido). Omítelo si no hay mínimo." },
          max_amount: { type: "number", description: "Importe máximo (IVA incluido). Omítelo si no hay máximo." },
          min_quantity: { type: "number", description: "Cantidad mínima (líneas BILLABLE). Omítelo si no filtra por cantidad." },
          max_quantity: { type: "number", description: "Cantidad máxima (líneas BILLABLE). Omítelo si no filtra por cantidad." },
          payment: {
            type: "string",
            enum: ["all", "pending", "paid"],
            description: "Filtrar por cobro. pending = no cobradas del todo; paid = cobradas. Omítelo para todas.",
          },
          order_by: {
            type: "string",
            enum: ["issue_date", "amount", "client"],
            description: "Campo de orden. Por defecto fecha de factura.",
          },
          order: {
            type: "string",
            enum: ["asc", "desc"],
            description: "Dirección. Por defecto asc.",
          },
          limit: { type: "integer", minimum: 1, maximum: 100, description: "Máximo de facturas a devolver (def. 50)." },
        },
        required: ["start_date", "end_date"],
      },
    },
  },
  async run(ctx, raw) {
    const args = InvoiceListArgs.parse(raw);
    const period = validatePeriod(args.start_date, args.end_date);
    let rows = await fetchCountedInvoices(ctx, period);
    if (args.payment === "paid") rows = rows.filter((r) => r.payment_status === "PAID");
    if (args.payment === "pending") rows = rows.filter((r) => r.payment_status !== "PAID");
    if (args.min_amount != null) rows = rows.filter((r) => num(r.grand_total) >= args.min_amount!);
    if (args.max_amount != null) rows = rows.filter((r) => num(r.grand_total) <= args.max_amount!);

    const names = await clientNames(ctx, [...new Set(rows.map((r) => r.client_id))]);
    const q = (args.client_query ?? "").trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => (names.get(r.client_id) ?? "").toLowerCase().includes(q));
    }

    const wantQty = args.min_quantity != null || args.max_quantity != null;
    const qtyMap = wantQty ? await billableQtyByInvoice(ctx, rows.map((r) => r.id)) : new Map<string, number>();
    if (args.min_quantity != null) rows = rows.filter((r) => (qtyMap.get(r.id) ?? 0) >= args.min_quantity!);
    if (args.max_quantity != null) rows = rows.filter((r) => (qtyMap.get(r.id) ?? 0) <= args.max_quantity!);

    const dir = args.order === "desc" ? -1 : 1;
    rows.sort((a, b) => {
      let cmp = 0;
      if (args.order_by === "amount") cmp = num(a.grand_total) - num(b.grand_total);
      else if (args.order_by === "client") {
        cmp = (names.get(a.client_id) ?? "").localeCompare(names.get(b.client_id) ?? "", "es");
      } else cmp = (a.issue_date ?? "").localeCompare(b.issue_date ?? "");
      return cmp * dir;
    });

    const matched = rows.length;
    const shownRows = rows.slice(0, args.limit);
    const shownQtyMap = wantQty ? qtyMap : await billableQtyByInvoice(ctx, shownRows.map((r) => r.id));
    const codes = await seriesCodes(ctx, [...new Set(shownRows.map((r) => r.series_id))]);
    return {
      period,
      filters: {
        client_query: q || null,
        min_amount: args.min_amount ?? null,
        max_amount: args.max_amount ?? null,
        min_quantity: args.min_quantity ?? null,
        max_quantity: args.max_quantity ?? null,
        payment: args.payment,
      },
      order_by: args.order_by,
      order: args.order,
      matched_count: matched,
      shown: shownRows.length,
      truncated: matched > shownRows.length,
      invoices: shownRows.map((r) => ({
        invoice_number: invoiceRef(r, codes),
        comment: clipNotes(r.notes),
        issue_date: r.issue_date,
        client: names.get(r.client_id) ?? "Cliente desconocido",
        amount: round2(num(r.grand_total)),
        quantity: round2(shownQtyMap.get(r.id) ?? 0),
      })),
    };
  },
};

export const billingTools: AiTool[] = [
  getBillingSummary,
  getTopClientsByBilling,
  getPendingInvoices,
  getInvoiceList,
  getBillingComparison,
  getClientBillingComparison,
];
