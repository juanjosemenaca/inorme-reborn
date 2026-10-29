import { z } from "npm:zod@3.23.8";
import { monthKey, percentChange, previousPeriod, round2, validatePeriod, type Period } from "../dates.ts";
import { expensesScope } from "../permissions.ts";
import { DATE_PARAM, MAX_ROWS, ToolError, dbFail, num, type AiTool, type ToolContext } from "./types.ts";

/** Categorías = columnas `amount_*` de worker_expense_sheet_lines. */
const CATEGORIES = [
  { column: "amount_tickets", label: "Billetes / transporte" },
  { column: "amount_taxis_parking", label: "Taxis y parking" },
  { column: "amount_kms_fuel", label: "Kilometraje y combustible" },
  { column: "amount_toll", label: "Peajes" },
  { column: "amount_per_diem", label: "Dietas" },
  { column: "amount_hotel", label: "Hotel" },
  { column: "amount_supplies", label: "Material" },
  { column: "amount_other", label: "Otros" },
] as const;

type CategoryColumn = (typeof CATEGORIES)[number]["column"];

const SHEET_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"] as const;
/** Por defecto: lo enviado y lo aprobado (gasto real declarado). */
const DEFAULT_STATUSES: readonly string[] = ["SUBMITTED", "APPROVED"];

type SheetRow = { id: string; company_worker_id: string; status: string; period_start: string; period_end: string };
type LineRow = { sheet_id: string; expense_date: string } & Record<CategoryColumn, string | number>;

async function fetchSheetsAndLines(ctx: ToolContext, period: Period, statuses: readonly string[]) {
  const scope = expensesScope(ctx.principal);
  if (!scope.all && !scope.companyWorkerId) {
    throw new ToolError("no_worker_profile", "Tu usuario no tiene ficha de trabajador asociada; no hay gastos que consultar.");
  }
  let sq = ctx.db
    .from("worker_expense_sheets")
    .select("id, company_worker_id, status, period_start, period_end")
    .in("status", [...statuses])
    .lte("period_start", period.end)
    .gte("period_end", period.start)
    .limit(MAX_ROWS);
  if (!scope.all) sq = sq.eq("company_worker_id", scope.companyWorkerId as string);
  const { data: sheets, error: sErr } = await sq;
  if (sErr) dbFail("worker_expense_sheets", sErr);
  const sheetRows = (sheets ?? []) as SheetRow[];
  if (sheetRows.length === 0) return { sheets: sheetRows, lines: [] as LineRow[] };

  const ids = sheetRows.map((s) => s.id);
  const cols = `sheet_id, expense_date, ${CATEGORIES.map((c) => c.column).join(", ")}`;
  const { data: lines, error: lErr } = await ctx.db
    .from("worker_expense_sheet_lines")
    .select(cols)
    .in("sheet_id", ids.slice(0, 1000))
    .gte("expense_date", period.start)
    .lte("expense_date", period.end)
    .limit(MAX_ROWS);
  if (lErr) dbFail("worker_expense_sheet_lines", lErr);
  return { sheets: sheetRows, lines: (lines ?? []) as unknown as LineRow[] };
}

function lineTotal(line: LineRow): number {
  let t = 0;
  for (const c of CATEGORIES) t += num(line[c.column]);
  return t;
}

function aggregate(sheets: SheetRow[], lines: LineRow[]) {
  const byCategory = CATEGORIES.map((c) => ({ category: c.label, total: 0 }));
  const byMonth = new Map<string, number>();
  const bySheet = new Map<string, number>();
  let total = 0;
  for (const l of lines) {
    const lt = lineTotal(l);
    total += lt;
    CATEGORIES.forEach((c, i) => {
      byCategory[i].total += num(l[c.column]);
    });
    const mk = monthKey(l.expense_date);
    byMonth.set(mk, (byMonth.get(mk) ?? 0) + lt);
    bySheet.set(l.sheet_id, (bySheet.get(l.sheet_id) ?? 0) + lt);
  }
  const byStatus = new Map<string, { sheets: number; total: number }>();
  const byWorker = new Map<string, { sheets: number; total: number }>();
  for (const s of sheets) {
    const st = byStatus.get(s.status) ?? { sheets: 0, total: 0 };
    st.sheets += 1;
    st.total += bySheet.get(s.id) ?? 0;
    byStatus.set(s.status, st);
    const w = byWorker.get(s.company_worker_id) ?? { sheets: 0, total: 0 };
    w.sheets += 1;
    w.total += bySheet.get(s.id) ?? 0;
    byWorker.set(s.company_worker_id, w);
  }
  return {
    total: round2(total),
    sheet_count: sheets.length,
    line_count: lines.length,
    by_category: byCategory
      .map((c) => ({ ...c, total: round2(c.total), share_pct: total ? round2((c.total / total) * 100) : null }))
      .sort((a, b) => b.total - a.total),
    by_month: [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, t]) => ({ month, total: round2(t) })),
    by_status: [...byStatus.entries()].map(([status, v]) => ({ status, sheets: v.sheets, total: round2(v.total) })),
    byWorker,
  };
}

async function workerNames(ctx: ToolContext, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const { data, error } = await ctx.db
    .from("company_workers")
    .select("id, first_name, last_name")
    .in("id", ids.slice(0, 200));
  if (error) dbFail("company_workers", error);
  for (const w of (data ?? []) as { id: string; first_name: string; last_name: string }[]) {
    map.set(w.id, `${w.first_name} ${w.last_name}`.trim());
  }
  return map;
}

// ---------------------------------------------------------------------------

const SummaryArgs = z.object({
  start_date: z.string(),
  end_date: z.string(),
  compare_previous_period: z.boolean().optional().default(false),
  statuses: z.array(z.enum(SHEET_STATUSES)).min(1).max(4).optional(),
});

export const getExpensesSummary: AiTool = {
  definition: {
    type: "function",
    function: {
      name: "get_expenses_summary",
      description:
        "Resumen de hojas de gastos de trabajadores en un período: total, por categoría, por mes, por estado de la hoja, nº de hojas y (para administración) principales trabajadores. Opcionalmente compara con el período anterior.",
      parameters: {
        type: "object",
        properties: {
          start_date: DATE_PARAM,
          end_date: DATE_PARAM,
          compare_previous_period: { type: "boolean" },
          statuses: {
            type: "array",
            items: { type: "string", enum: [...SHEET_STATUSES] },
            description: "Estados de hoja a incluir. Por defecto SUBMITTED y APPROVED.",
          },
        },
        required: ["start_date", "end_date"],
      },
    },
  },
  async run(ctx, raw) {
    const args = SummaryArgs.parse(raw);
    const period = validatePeriod(args.start_date, args.end_date);
    const statuses = args.statuses ?? DEFAULT_STATUSES;
    const { sheets, lines } = await fetchSheetsAndLines(ctx, period, statuses);
    const agg = aggregate(sheets, lines);
    const { byWorker, ...current } = agg;
    const out: Record<string, unknown> = {
      period,
      statuses_included: statuses,
      scope: ctx.principal.role === "ADMIN" ? "all_workers" : "own_expenses_only",
      current,
      top_categories: current.by_category.slice(0, 3),
    };
    if (ctx.principal.role === "ADMIN") {
      const top = [...byWorker.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 10);
      const names = await workerNames(ctx, top.map(([id]) => id));
      out.top_workers = top.map(([id, v]) => ({
        worker: names.get(id) ?? "Trabajador",
        sheets: v.sheets,
        total: round2(v.total),
      }));
    }
    if (args.compare_previous_period) {
      const prevP = previousPeriod(period);
      const prev = await fetchSheetsAndLines(ctx, prevP, statuses);
      const { byWorker: _ignored, ...prevAgg } = aggregate(prev.sheets, prev.lines);
      out.previous = { period: prevP, ...prevAgg };
      out.comparison = {
        total_diff: round2(current.total - prevAgg.total),
        total_pct: percentChange(prevAgg.total, current.total),
        sheet_count_diff: current.sheet_count - prevAgg.sheet_count,
      };
    }
    return out;
  },
};

// ---------------------------------------------------------------------------

const TopCategoriesArgs = z.object({
  start_date: z.string(),
  end_date: z.string(),
  limit: z.number().int().min(1).max(8).optional().default(5),
});

export const getTopExpenseCategories: AiTool = {
  definition: {
    type: "function",
    function: {
      name: "get_top_expense_categories",
      description: "Categorías de gasto con mayor importe en un período (hojas enviadas o aprobadas).",
      parameters: {
        type: "object",
        properties: {
          start_date: DATE_PARAM,
          end_date: DATE_PARAM,
          limit: { type: "integer", minimum: 1, maximum: 8 },
        },
        required: ["start_date", "end_date"],
      },
    },
  },
  async run(ctx, raw) {
    const args = TopCategoriesArgs.parse(raw);
    const period = validatePeriod(args.start_date, args.end_date);
    const { sheets, lines } = await fetchSheetsAndLines(ctx, period, DEFAULT_STATUSES);
    const { by_category, total } = aggregate(sheets, lines);
    return {
      period,
      scope: ctx.principal.role === "ADMIN" ? "all_workers" : "own_expenses_only",
      total,
      categories: by_category.slice(0, args.limit),
    };
  },
};

export const expenseTools: AiTool[] = [getExpensesSummary, getTopExpenseCategories];
