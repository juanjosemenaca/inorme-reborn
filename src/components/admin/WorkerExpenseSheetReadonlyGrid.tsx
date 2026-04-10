import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { computeLineTotal, computeSheetTotal } from "@/api/workerExpenseSheetsApi";
import type { WorkerExpenseCategoryKey } from "@/types/workerExpenses";
import { WORKER_EXPENSE_CATEGORY_KEYS } from "@/types/workerExpenses";
import type { WorkerExpenseSheetRecord } from "@/types/workerExpenses";

const CAT_KEYS: WorkerExpenseCategoryKey[] = [...WORKER_EXPENSE_CATEGORY_KEYS];

function catLabelKey(k: WorkerExpenseCategoryKey): string {
  const map: Record<WorkerExpenseCategoryKey, string> = {
    tickets: "admin.expenses.cat_tickets",
    taxisParking: "admin.expenses.cat_taxis_parking",
    kmsFuel: "admin.expenses.cat_kms_fuel",
    toll: "admin.expenses.cat_toll",
    perDiem: "admin.expenses.cat_per_diem",
    hotel: "admin.expenses.cat_hotel",
    supplies: "admin.expenses.cat_supplies",
    other: "admin.expenses.cat_other",
  };
  return map[k];
}

type TFn = (key: string) => string;

type Props = {
  sheet: WorkerExpenseSheetRecord;
  localeTag: string;
  t: TFn;
};

export function WorkerExpenseSheetReadonlyGrid({ sheet, localeTag, t }: Props) {
  const lines = [...sheet.lines].sort((a, b) => a.expenseDate.localeCompare(b.expenseDate));

  const columnTotals = (() => {
    const tot = {} as Record<WorkerExpenseCategoryKey, number>;
    for (const k of CAT_KEYS) tot[k] = 0;
    for (const row of lines) {
      for (const k of CAT_KEYS) tot[k] += row.amounts[k] ?? 0;
    }
    for (const k of CAT_KEYS) tot[k] = Math.round(tot[k] * 100) / 100;
    return tot;
  })();

  const grandTotal = computeSheetTotal(sheet);

  const fmt = (n: number) =>
    n.toLocaleString(localeTag, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 min-w-[100px] bg-card">{t("admin.expenses.col_day")}</TableHead>
            {CAT_KEYS.map((k) => (
              <TableHead key={k} className="text-right min-w-[88px] whitespace-normal text-xs font-medium">
                {t(catLabelKey(k))}
              </TableHead>
            ))}
            <TableHead className="text-right min-w-[90px]">{t("admin.expenses.col_day_total")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((row) => (
            <TableRow key={row.expenseDate}>
              <TableCell className="sticky left-0 z-10 bg-card text-sm whitespace-nowrap">
                {new Date(`${row.expenseDate}T12:00:00`).toLocaleDateString(localeTag, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </TableCell>
              {CAT_KEYS.map((k) => (
                <TableCell key={k} className="text-right tabular-nums text-sm">
                  {row.amounts[k] ? fmt(row.amounts[k]) : "—"}
                </TableCell>
              ))}
              <TableCell className="text-right font-medium tabular-nums text-sm">{fmt(computeLineTotal(row.amounts))}</TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/50 font-medium">
            <TableCell className="sticky left-0 z-10 bg-muted/50">{t("admin.expenses.row_month_total")}</TableCell>
            {CAT_KEYS.map((k) => (
              <TableCell key={k} className="text-right tabular-nums text-sm">
                {fmt(columnTotals[k])}
              </TableCell>
            ))}
            <TableCell className="text-right tabular-nums">{fmt(grandTotal)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
