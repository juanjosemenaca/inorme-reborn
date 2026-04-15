import type { WorkerExpenseCategoryKey, WorkerExpenseLineAmounts } from "@/types/workerExpenses";
import { WORKER_EXPENSE_CATEGORY_KEYS } from "@/types/workerExpenses";
import type { WorkerExpenseSheetRecord } from "@/types/workerExpenses";
import { jsPDF } from "jspdf";

function computeLineTotal(amounts: WorkerExpenseLineAmounts): number {
  let t = 0;
  for (const k of WORKER_EXPENSE_CATEGORY_KEYS) t += amounts[k] ?? 0;
  return Math.round(t * 100) / 100;
}

function computeSheetTotal(sheet: Pick<WorkerExpenseSheetRecord, "lines">): number {
  let t = 0;
  for (const line of sheet.lines) t += computeLineTotal(line.amounts);
  return Math.round(t * 100) / 100;
}

const CAT_KEYS: WorkerExpenseCategoryKey[] = [...WORKER_EXPENSE_CATEGORY_KEYS];

/** Encabezados cortos para caber en A4 apaisado (PDF fijo en español). */
const PDF_CAT_HEADERS: Record<WorkerExpenseCategoryKey, string> = {
  tickets: "Billetes",
  taxisParking: "Taxi/Park.",
  kmsFuel: "Km/Gas",
  toll: "Autop.",
  perDiem: "Dietas",
  hotel: "Hotel",
  supplies: "Material",
  other: "Otros",
};

export type ExpenseSheetPdfMeta = {
  workerName: string;
  periodLabel: string;
  validatedAtLabel: string;
};

/**
 * Genera el PDF oficial de la hoja validada (mismo contenido que se sube a Storage).
 */
export async function generateExpenseSheetPdfBlob(
  sheet: WorkerExpenseSheetRecord,
  meta: ExpenseSheetPdfMeta
): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape", compress: true });

  const pageW = 297;
  const pageH = 210;
  const margin = 10;
  const maxY = pageH - margin;
  let y = margin;

  const lines = [...sheet.lines].sort((a, b) => a.expenseDate.localeCompare(b.expenseDate));
  const total = computeSheetTotal(sheet);

  const fmtMoney = (n: number) =>
    n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const addLine = (text: string, size: number, style: "normal" | "bold" = "normal") => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const h = size * 0.45 + 1.2;
    if (y + h > maxY) {
      doc.addPage();
      y = margin;
    }
    doc.text(text, margin, y);
    y += h;
  };

  const addWrapped = (text: string, size: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    const w = pageW - 2 * margin;
    const parts = doc.splitTextToSize(text, w);
    const lineH = size * 0.45 + 0.8;
    for (const line of parts) {
      if (y + lineH > maxY) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineH;
    }
  };

  addLine("Hoja de gastos — Validada", 14, "bold");
  addLine(`Trabajador: ${meta.workerName}`, 10);
  addLine(`Periodo: ${meta.periodLabel}`, 10);
  addLine(`Importe total: ${fmtMoney(total)} EUR`, 10);
  addLine(`Validada el: ${meta.validatedAtLabel}`, 10);
  y += 2;

  const colDay = 24;
  const colCat = 26;
  const startX = margin;
  let x = startX;

  const rowH = 5;
  const headerSize = 7;
  const cellSize = 6.5;

  const drawHeaderRow = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(headerSize);
    x = startX;
    doc.text("Fecha", x + 1, y + 4);
    x += colDay;
    for (const k of CAT_KEYS) {
      const h = PDF_CAT_HEADERS[k];
      doc.text(h, x + 0.5, y + 4, { maxWidth: colCat - 1 });
      x += colCat;
    }
    doc.text("Total día", x + 1, y + 4);
    y += rowH + 1;
  };

  const ensureRow = () => {
    if (y + rowH > maxY) {
      doc.addPage();
      y = margin;
      drawHeaderRow();
    }
  };

  drawHeaderRow();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(cellSize);

  for (const row of lines) {
    ensureRow();
    x = startX;
    const dayStr = row.expenseDate;
    doc.text(dayStr, x + 1, y + 4);
    x += colDay;
    for (const k of CAT_KEYS) {
      const v = row.amounts[k];
      const s = v ? fmtMoney(v) : "—";
      doc.text(s, x + 1, y + 4, { maxWidth: colCat - 1 });
      x += colCat;
    }
    doc.text(fmtMoney(computeLineTotal(row.amounts)), x + 1, y + 4);
    y += rowH;
  }

  ensureRow();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(cellSize);
  x = startX;
  doc.text("Totales", x + 1, y + 4);
  x += colDay;
  const colTotals: Record<WorkerExpenseCategoryKey, number> = {} as Record<
    WorkerExpenseCategoryKey,
    number
  >;
  for (const k of CAT_KEYS) colTotals[k] = 0;
  for (const row of lines) {
    for (const k of CAT_KEYS) colTotals[k] += row.amounts[k] ?? 0;
  }
  for (const k of CAT_KEYS) {
    doc.text(fmtMoney(Math.round(colTotals[k] * 100) / 100), x + 1, y + 4, { maxWidth: colCat - 1 });
    x += colCat;
  }
  doc.text(fmtMoney(total), x + 1, y + 4);
  y += rowH + 3;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  if (y + 10 > maxY) {
    doc.addPage();
    y = margin;
  }
  doc.text("Observaciones", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const obs = sheet.observations?.trim() || "—";
  addWrapped(obs, 8);

  return doc.output("blob");
}
