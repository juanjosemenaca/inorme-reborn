export type WorkerExpensePeriodKind = "MONTH" | "CUSTOM";
export type WorkerExpenseSheetStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

/** Claves de categoría alineadas con columnas en BD y claves i18n. */
export const WORKER_EXPENSE_CATEGORY_KEYS = [
  "tickets",
  "taxisParking",
  "kmsFuel",
  "toll",
  "perDiem",
  "hotel",
  "supplies",
  "other",
] as const;

export type WorkerExpenseCategoryKey = (typeof WORKER_EXPENSE_CATEGORY_KEYS)[number];

export type WorkerExpenseLineAmounts = Record<WorkerExpenseCategoryKey, number>;

export interface WorkerExpenseSheetLineRecord {
  id: string;
  sheetId: string;
  expenseDate: string;
  amounts: WorkerExpenseLineAmounts;
  createdAt: string;
  updatedAt: string;
}

export interface WorkerExpenseSheetAttachmentRecord {
  id: string;
  sheetId: string;
  /** Día del periodo al que se asocia el justificante, o null si aplica a todo el periodo. */
  expenseDate: string | null;
  storagePath: string;
  originalFilename: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  createdAt: string;
}

export interface WorkerExpenseSheetRecord {
  id: string;
  companyWorkerId: string;
  periodKind: WorkerExpensePeriodKind;
  calendarYear: number | null;
  calendarMonth: number | null;
  periodStart: string;
  periodEnd: string;
  status: WorkerExpenseSheetStatus;
  observations: string;
  submittedAt: string | null;
  reviewedByBackofficeUserId: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  /** Ruta en Storage (p. ej. `expense-sheets/{id}.pdf`) tras validar. */
  pdfStoragePath: string | null;
  pdfGeneratedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: WorkerExpenseSheetLineRecord[];
  attachments: WorkerExpenseSheetAttachmentRecord[];
}
