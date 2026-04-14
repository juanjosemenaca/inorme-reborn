import { fetchBackofficeUsers, getProfileByAuthUserId } from "@/api/backofficeUsersApi";
import { createBackofficeMessage } from "@/api/backofficeMessagesApi";
import { getCompanyWorkerById } from "@/api/companyWorkersApi";
import { getProjectDocumentSignedUrl, PROJECT_DOCUMENTS_BUCKET } from "@/api/projectsApi";
import { generateExpenseSheetPdfBlob } from "@/lib/expenseSheetPdf";
import { companyWorkerDisplayName } from "@/types/companyWorkers";
import { requireSupabase } from "@/api/supabaseRequire";
import { getErrorMessage } from "@/lib/errorMessage";
import type {
  WorkerExpenseSheetAttachmentRow,
  WorkerExpenseSheetLineRow,
  WorkerExpenseSheetRow,
} from "@/types/database";
import type {
  WorkerExpenseCategoryKey,
  WorkerExpenseLineAmounts,
  WorkerExpensePeriodKind,
  WorkerExpenseSheetAttachmentRecord,
  WorkerExpenseSheetLineRecord,
  WorkerExpenseSheetRecord,
  WorkerExpenseSheetStatus,
} from "@/types/workerExpenses";
import { WORKER_EXPENSE_CATEGORY_KEYS } from "@/types/workerExpenses";

function throwErr(e: unknown): never {
  throw new Error(getErrorMessage(e));
}

function parseMoney(raw: unknown): number {
  if (raw === null || raw === undefined) return 0;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

const DB_TO_KEY: Record<string, WorkerExpenseCategoryKey> = {
  amount_tickets: "tickets",
  amount_taxis_parking: "taxisParking",
  amount_kms_fuel: "kmsFuel",
  amount_toll: "toll",
  amount_per_diem: "perDiem",
  amount_hotel: "hotel",
  amount_supplies: "supplies",
  amount_other: "other",
};

const MAX_EXPENSE_ATTACHMENT_BYTES = 20 * 1024 * 1024;

function attachmentRowToDomain(row: WorkerExpenseSheetAttachmentRow): WorkerExpenseSheetAttachmentRecord {
  return {
    id: row.id,
    sheetId: row.sheet_id,
    expenseDate: row.expense_date ? String(row.expense_date).slice(0, 10) : null,
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    createdAt: row.created_at,
  };
}

function lineRowToDomain(row: WorkerExpenseSheetLineRow): WorkerExpenseSheetLineRecord {
  const amounts = {} as WorkerExpenseLineAmounts;
  for (const k of WORKER_EXPENSE_CATEGORY_KEYS) {
    amounts[k] = 0;
  }
  (Object.keys(DB_TO_KEY) as (keyof WorkerExpenseSheetLineRow)[]).forEach((col) => {
    const key = DB_TO_KEY[col];
    if (key) amounts[key] = parseMoney(row[col]);
  });
  return {
    id: row.id,
    sheetId: row.sheet_id,
    expenseDate: String(row.expense_date).slice(0, 10),
    amounts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sheetRowToDomain(
  row: WorkerExpenseSheetRow,
  lines: WorkerExpenseSheetLineRow[],
  attachments: WorkerExpenseSheetAttachmentRow[]
): WorkerExpenseSheetRecord {
  return {
    id: row.id,
    companyWorkerId: row.company_worker_id,
    periodKind: row.period_kind as WorkerExpensePeriodKind,
    calendarYear: row.calendar_year,
    calendarMonth: row.calendar_month,
    periodStart: String(row.period_start).slice(0, 10),
    periodEnd: String(row.period_end).slice(0, 10),
    status: row.status as WorkerExpenseSheetStatus,
    observations: row.observations ?? "",
    submittedAt: row.submitted_at,
    reviewedByBackofficeUserId: row.reviewed_by_backoffice_user_id,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,
    pdfStoragePath: row.pdf_storage_path ?? null,
    pdfGeneratedAt: row.pdf_generated_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lines: lines.map(lineRowToDomain),
    attachments: attachments.map(attachmentRowToDomain),
  };
}

async function fetchAttachmentsBySheetIds(
  sb: ReturnType<typeof requireSupabase>,
  sheetIds: string[]
): Promise<Map<string, WorkerExpenseSheetAttachmentRow[]>> {
  const map = new Map<string, WorkerExpenseSheetAttachmentRow[]>();
  if (sheetIds.length === 0) return map;
  for (const id of sheetIds) map.set(id, []);
  const { data, error } = await sb
    .from("worker_expense_sheet_attachments")
    .select("*")
    .in("sheet_id", sheetIds)
    .order("created_at", { ascending: true });
  if (error) throwErr(error);
  for (const row of (data ?? []) as WorkerExpenseSheetAttachmentRow[]) {
    map.get(row.sheet_id)?.push(row);
  }
  return map;
}

type Profile = { id: string; role: "ADMIN" | "WORKER"; companyWorkerId: string | null };

async function requireProfile(): Promise<Profile> {
  const sb = requireSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sesión no válida.");
  const profile = await getProfileByAuthUserId(user.id);
  if (!profile) throw new Error("No se pudo resolver el perfil.");
  return {
    id: profile.id,
    role: profile.role,
    companyWorkerId: profile.companyWorkerId,
  };
}

/** Lectura de una hoja concreta: el trabajador solo la suya; administración ve todas. */
function assertCanReadSheet(profile: Profile, companyWorkerId: string): void {
  if (profile.role === "ADMIN") return;
  if (profile.role === "WORKER" && profile.companyWorkerId === companyWorkerId) return;
  throw new Error("No puedes acceder a la hoja de gastos de otro trabajador.");
}

/** Listado por trabajador: solo la propia ficha (trabajador o admin con ficha). */
function assertSelfWorkerScope(profile: Profile, companyWorkerId: string): void {
  if (profile.companyWorkerId !== companyWorkerId) {
    throw new Error("No puedes consultar las hojas de otro trabajador.");
  }
  if (profile.role !== "WORKER" && profile.role !== "ADMIN") {
    throw new Error("Sin permiso.");
  }
}

/** Edición y envío: trabajador con esa ficha, o administrador con la misma ficha (módulo GASTOS). */
function canEditSheetAsWorker(profile: Profile, companyWorkerId: string): boolean {
  if (profile.companyWorkerId !== companyWorkerId) return false;
  return profile.role === "WORKER" || profile.role === "ADMIN";
}

function eachDateInRange(startYmd: string, endYmd: string): string[] {
  const out: string[] = [];
  const a = new Date(`${startYmd}T12:00:00`);
  const b = new Date(`${endYmd}T12:00:00`);
  for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${day}`);
  }
  return out;
}

export function monthBounds(year: number, month1to12: number): { start: string; end: string } {
  const start = new Date(year, month1to12 - 1, 1);
  const end = new Date(year, month1to12, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: fmt(start), end: fmt(end) };
}

export async function fetchWorkerExpenseSheetById(sheetId: string): Promise<WorkerExpenseSheetRecord | null> {
  const sb = requireSupabase();
  const profile = await requireProfile();

  const { data: row, error } = await sb
    .from("worker_expense_sheets")
    .select("*")
    .eq("id", sheetId)
    .maybeSingle();
  if (error) throwErr(error);
  if (!row) return null;

  assertCanReadSheet(profile, (row as WorkerExpenseSheetRow).company_worker_id);

  const { data: lineRows, error: e2 } = await sb
    .from("worker_expense_sheet_lines")
    .select("*")
    .eq("sheet_id", sheetId)
    .order("expense_date", { ascending: true });
  if (e2) throwErr(e2);

  const attMap = await fetchAttachmentsBySheetIds(sb, [sheetId]);
  const attachments = attMap.get(sheetId) ?? [];

  return sheetRowToDomain(
    row as WorkerExpenseSheetRow,
    (lineRows ?? []) as WorkerExpenseSheetLineRow[],
    attachments
  );
}

export async function fetchWorkerExpenseSheetsForWorker(
  companyWorkerId: string
): Promise<WorkerExpenseSheetRecord[]> {
  const sb = requireSupabase();
  const profile = await requireProfile();
  assertSelfWorkerScope(profile, companyWorkerId);

  const { data: rows, error } = await sb
    .from("worker_expense_sheets")
    .select("*")
    .eq("company_worker_id", companyWorkerId)
    .order("period_start", { ascending: false });
  if (error) throwErr(error);
  if (!rows?.length) return [];

  const ids = rows.map((r) => (r as WorkerExpenseSheetRow).id);
  const { data: allLines, error: e2 } = await sb
    .from("worker_expense_sheet_lines")
    .select("*")
    .in("sheet_id", ids)
    .order("expense_date", { ascending: true });
  if (e2) throwErr(e2);

  const bySheet = new Map<string, WorkerExpenseSheetLineRow[]>();
  for (const lid of ids) bySheet.set(lid, []);
  for (const ln of allLines ?? []) {
    const sid = (ln as WorkerExpenseSheetLineRow).sheet_id;
    bySheet.get(sid)?.push(ln as WorkerExpenseSheetLineRow);
  }

  const attMap = await fetchAttachmentsBySheetIds(sb, ids);

  return (rows as WorkerExpenseSheetRow[]).map((r) =>
    sheetRowToDomain(r, bySheet.get(r.id) ?? [], attMap.get(r.id) ?? [])
  );
}

export async function fetchAllWorkerExpenseSheets(): Promise<WorkerExpenseSheetRecord[]> {
  const profile = await requireProfile();
  if (profile.role !== "ADMIN") throw new Error("Solo administración puede ver todas las hojas.");

  const sb = requireSupabase();
  const { data: rows, error } = await sb
    .from("worker_expense_sheets")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throwErr(error);
  if (!rows?.length) return [];

  const ids = rows.map((r) => (r as WorkerExpenseSheetRow).id);
  const { data: allLines, error: e2 } = await sb
    .from("worker_expense_sheet_lines")
    .select("*")
    .in("sheet_id", ids)
    .order("expense_date", { ascending: true });
  if (e2) throwErr(e2);

  const bySheet = new Map<string, WorkerExpenseSheetLineRow[]>();
  for (const lid of ids) bySheet.set(lid, []);
  for (const ln of allLines ?? []) {
    const sid = (ln as WorkerExpenseSheetLineRow).sheet_id;
    bySheet.get(sid)?.push(ln as WorkerExpenseSheetLineRow);
  }

  const attMap = await fetchAttachmentsBySheetIds(sb, ids);

  return (rows as WorkerExpenseSheetRow[]).map((r) =>
    sheetRowToDomain(r, bySheet.get(r.id) ?? [], attMap.get(r.id) ?? [])
  );
}

export async function fetchPendingWorkerExpenseSheets(): Promise<WorkerExpenseSheetRecord[]> {
  const all = await fetchAllWorkerExpenseSheets();
  return all.filter((s) => s.status === "SUBMITTED");
}

export type CreateExpenseSheetInput =
  | {
      periodKind: "MONTH";
      calendarYear: number;
      calendarMonth: number;
    }
  | {
      periodKind: "CUSTOM";
      periodStart: string;
      periodEnd: string;
    };

export async function getOrCreateExpenseSheet(
  companyWorkerId: string,
  input: CreateExpenseSheetInput
): Promise<WorkerExpenseSheetRecord> {
  const profile = await requireProfile();
  assertSelfWorkerScope(profile, companyWorkerId);
  if (!canEditSheetAsWorker(profile, companyWorkerId)) {
    throw new Error("No puedes crear o editar la hoja de gastos de otro trabajador.");
  }

  let periodKind: WorkerExpensePeriodKind;
  let calendarYear: number | null;
  let calendarMonth: number | null;
  let periodStart: string;
  let periodEnd: string;

  if (input.periodKind === "MONTH") {
    periodKind = "MONTH";
    calendarYear = input.calendarYear;
    calendarMonth = input.calendarMonth;
    const b = monthBounds(input.calendarYear, input.calendarMonth);
    periodStart = b.start;
    periodEnd = b.end;
  } else {
    periodKind = "CUSTOM";
    calendarYear = null;
    calendarMonth = null;
    periodStart = input.periodStart;
    periodEnd = input.periodEnd;
    if (periodStart > periodEnd) throw new Error("La fecha de inicio debe ser anterior al fin.");
  }

  const existing = await fetchWorkerExpenseSheetsForWorker(companyWorkerId);
  const hit = existing.find((s) => s.periodStart === periodStart && s.periodEnd === periodEnd);
  if (hit) return hit;

  const sb = requireSupabase();
  const { data: row, error } = await sb
    .from("worker_expense_sheets")
    .insert({
      company_worker_id: companyWorkerId,
      period_kind: periodKind,
      calendar_year: calendarYear,
      calendar_month: calendarMonth,
      period_start: periodStart,
      period_end: periodEnd,
      status: "DRAFT",
      observations: "",
    })
    .select("*")
    .single();
  if (error) throwErr(error);

  const sheetId = (row as WorkerExpenseSheetRow).id;
  const days = eachDateInRange(periodStart, periodEnd);
  const lineInserts = days.map((expense_date) => ({
    sheet_id: sheetId,
    expense_date,
    amount_tickets: 0,
    amount_taxis_parking: 0,
    amount_kms_fuel: 0,
    amount_toll: 0,
    amount_per_diem: 0,
    amount_hotel: 0,
    amount_supplies: 0,
    amount_other: 0,
  }));

  if (lineInserts.length > 0) {
    const { error: e2 } = await sb.from("worker_expense_sheet_lines").insert(lineInserts);
    if (e2) throwErr(e2);
  }

  return (await fetchWorkerExpenseSheetById(sheetId))!;
}

function lineAmountsToRow(amounts: WorkerExpenseLineAmounts): Record<string, number> {
  return {
    amount_tickets: amounts.tickets,
    amount_taxis_parking: amounts.taxisParking,
    amount_kms_fuel: amounts.kmsFuel,
    amount_toll: amounts.toll,
    amount_per_diem: amounts.perDiem,
    amount_hotel: amounts.hotel,
    amount_supplies: amounts.supplies,
    amount_other: amounts.other,
  };
}

export async function saveExpenseSheetDraft(
  sheetId: string,
  input: { observations: string; lines: { expenseDate: string; amounts: WorkerExpenseLineAmounts }[] }
): Promise<void> {
  const profile = await requireProfile();
  const sheet = await fetchWorkerExpenseSheetById(sheetId);
  if (!sheet) throw new Error("Hoja no encontrada.");
  if (!canEditSheetAsWorker(profile, sheet.companyWorkerId)) {
    throw new Error("Solo el trabajador puede editar esta hoja.");
  }
  if (sheet.status !== "DRAFT" && sheet.status !== "REJECTED") {
    throw new Error("Solo se puede editar un borrador o una hoja rechazada.");
  }

  const allowed = new Set(eachDateInRange(sheet.periodStart, sheet.periodEnd));
  for (const row of input.lines) {
    if (!allowed.has(row.expenseDate)) {
      throw new Error("Hay líneas fuera del periodo de la hoja.");
    }
  }

  const sb = requireSupabase();
  const { error: e0 } = await sb
    .from("worker_expense_sheets")
    .update({
      observations: input.observations.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sheetId);
  if (e0) throwErr(e0);

  for (const line of input.lines) {
    const payload = lineAmountsToRow(line.amounts);
    const { error } = await sb
      .from("worker_expense_sheet_lines")
      .update(payload)
      .eq("sheet_id", sheetId)
      .eq("expense_date", line.expenseDate);
    if (error) throwErr(error);
  }
}

export async function submitExpenseSheet(sheetId: string): Promise<void> {
  const profile = await requireProfile();
  const sheet = await fetchWorkerExpenseSheetById(sheetId);
  if (!sheet) throw new Error("Hoja no encontrada.");
  if (!canEditSheetAsWorker(profile, sheet.companyWorkerId)) {
    throw new Error("Solo el trabajador puede enviar esta hoja.");
  }
  if (sheet.status !== "DRAFT" && sheet.status !== "REJECTED") {
    throw new Error("Esta hoja ya fue enviada o cerrada.");
  }

  const sb = requireSupabase();
  const now = new Date().toISOString();
  const { error } = await sb
    .from("worker_expense_sheets")
    .update({
      status: "SUBMITTED",
      submitted_at: now,
      rejection_reason: null,
      reviewed_at: null,
      reviewed_by_backoffice_user_id: null,
      updated_at: now,
    })
    .eq("id", sheetId);
  if (error) throwErr(error);

  const worker = await getCompanyWorkerById(sheet.companyWorkerId);
  const label = worker ? `${worker.firstName} ${worker.lastName}`.trim() : sheet.companyWorkerId;
  const periodLabel = `${sheet.periodStart} → ${sheet.periodEnd}`;
  const body = `Hoja de gastos enviada.\nTrabajador: ${label}\nPeriodo: ${periodLabel}\nImporte total: ${computeSheetTotal(sheet).toFixed(2)}`;

  const admins = (await fetchBackofficeUsers()).filter((u) => u.role === "ADMIN" && u.active);
  await Promise.all(
    admins.map((a) =>
      createBackofficeMessage(a.id, {
        category: "WORKER_EXPENSE_SHEET",
        title: "Nueva hoja de gastos para validar",
        body,
        payload: {
          kind: "worker_expense_sheet",
          sheetId,
          companyWorkerId: sheet.companyWorkerId,
        },
      })
    )
  );
}

export async function approveExpenseSheet(sheetId: string): Promise<void> {
  const profile = await requireProfile();
  if (profile.role !== "ADMIN") throw new Error("Solo administración puede aprobar.");

  const sheet = await fetchWorkerExpenseSheetById(sheetId);
  if (!sheet || sheet.status !== "SUBMITTED") {
    throw new Error("La hoja no está enviada o no existe.");
  }

  const worker = await getCompanyWorkerById(sheet.companyWorkerId);
  const workerName = worker ? companyWorkerDisplayName(worker) : sheet.companyWorkerId;

  const now = new Date().toISOString();
  const validatedAtLabel = new Date(now).toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  });

  const periodLabel =
    sheet.periodKind === "MONTH" && sheet.calendarYear && sheet.calendarMonth
      ? `${sheet.calendarYear}-${String(sheet.calendarMonth).padStart(2, "0")}`
      : `${sheet.periodStart} → ${sheet.periodEnd}`;

  const blob = await generateExpenseSheetPdfBlob(sheet, {
    workerName,
    periodLabel,
    validatedAtLabel,
  });

  const storagePath = `expense-sheets/${sheet.id}.pdf`;
  const sb = requireSupabase();

  if (sheet.pdfStoragePath) {
    await sb.storage.from(PROJECT_DOCUMENTS_BUCKET).remove([sheet.pdfStoragePath]).catch(() => undefined);
  }

  const { error: upErr } = await sb.storage.from(PROJECT_DOCUMENTS_BUCKET).upload(storagePath, blob, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (upErr) throwErr(upErr);

  const { error } = await sb
    .from("worker_expense_sheets")
    .update({
      status: "APPROVED",
      reviewed_by_backoffice_user_id: profile.id,
      reviewed_at: now,
      rejection_reason: null,
      pdf_storage_path: storagePath,
      pdf_generated_at: now,
      updated_at: now,
    })
    .eq("id", sheetId)
    .eq("status", "SUBMITTED");

  if (error) {
    await sb.storage.from(PROJECT_DOCUMENTS_BUCKET).remove([storagePath]).catch(() => undefined);
    throwErr(error);
  }
}

/** Abre el PDF validado en una pestaña nueva (URL firmada). */
export async function openExpenseSheetPdfDownload(sheet: WorkerExpenseSheetRecord): Promise<void> {
  if (!sheet.pdfStoragePath) throw new Error("No hay PDF disponible para esta hoja.");
  const url = await getProjectDocumentSignedUrl(sheet.pdfStoragePath, 3600);
  window.open(url, "_blank", "noopener,noreferrer");
}

function sanitizeOriginalFilename(name: string): string {
  const n = name.replace(/[/\\]/g, "_").trim().slice(0, 200);
  return n || "archivo";
}

function extensionForUpload(file: File): string {
  const fromName = file.name.toLowerCase();
  const m = fromName.match(/(\.[a-z0-9]{1,8})$/);
  if (m) return m[1];
  const t = file.type.toLowerCase();
  if (t === "application/pdf") return ".pdf";
  if (t === "image/jpeg" || t === "image/jpg") return ".jpg";
  if (t === "image/png") return ".png";
  if (t === "image/webp") return ".webp";
  if (t === "image/gif") return ".gif";
  if (t === "image/heic") return ".heic";
  return "";
}

function assertExpenseAttachmentFileAccepted(file: File): void {
  if (file.size > MAX_EXPENSE_ATTACHMENT_BYTES) {
    throw new Error("El archivo supera el tamaño máximo permitido (20 MB).");
  }
  const okType =
    file.type === "application/pdf" ||
    file.type.startsWith("image/") ||
    file.type === "";
  const lower = file.name.toLowerCase();
  const okExt = /\.(pdf|jpe?g|png|gif|webp|heic)$/.test(lower);
  if (!okType && !okExt) {
    throw new Error("Formato no admitido. Usa PDF o imagen (JPEG, PNG…).");
  }
}

/**
 * Sube un justificante (ticket, factura, foto) asociado a la hoja.
 * Solo en borrador o rechazada; opcionalmente ligado a un día del periodo.
 */
export async function uploadExpenseSheetAttachment(
  sheetId: string,
  file: File,
  expenseDate: string | null
): Promise<WorkerExpenseSheetAttachmentRecord> {
  assertExpenseAttachmentFileAccepted(file);
  const profile = await requireProfile();
  const sheet = await fetchWorkerExpenseSheetById(sheetId);
  if (!sheet) throw new Error("Hoja no encontrada.");
  if (!canEditSheetAsWorker(profile, sheet.companyWorkerId)) {
    throw new Error("No puedes adjuntar archivos a esta hoja.");
  }
  if (sheet.status !== "DRAFT" && sheet.status !== "REJECTED") {
    throw new Error("Solo se pueden adjuntar archivos en borrador o en una hoja rechazada.");
  }
  const allowedDates = new Set(sheet.lines.map((l) => l.expenseDate));
  if (expenseDate !== null && !allowedDates.has(expenseDate)) {
    throw new Error("La fecha del justificante debe estar dentro del periodo de la hoja.");
  }

  const ext = extensionForUpload(file) || ".bin";
  const objectName = `${crypto.randomUUID()}${ext}`;
  const storagePath = `expense-sheets/${sheetId}/attachments/${objectName}`;

  const sb = requireSupabase();
  const { error: upErr } = await sb.storage.from(PROJECT_DOCUMENTS_BUCKET).upload(storagePath, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (upErr) throwErr(upErr);

  const { data: row, error: insErr } = await sb
    .from("worker_expense_sheet_attachments")
    .insert({
      sheet_id: sheetId,
      expense_date: expenseDate,
      storage_path: storagePath,
      original_filename: sanitizeOriginalFilename(file.name),
      mime_type: file.type || null,
      file_size_bytes: file.size,
      created_by_backoffice_user_id: profile.id,
    })
    .select("*")
    .single();
  if (insErr) {
    await sb.storage.from(PROJECT_DOCUMENTS_BUCKET).remove([storagePath]).catch(() => undefined);
    throwErr(insErr);
  }
  return attachmentRowToDomain(row as WorkerExpenseSheetAttachmentRow);
}

export async function deleteExpenseSheetAttachment(attachmentId: string): Promise<void> {
  const profile = await requireProfile();
  const sb = requireSupabase();
  const { data: row, error } = await sb
    .from("worker_expense_sheet_attachments")
    .select("*")
    .eq("id", attachmentId)
    .maybeSingle();
  if (error) throwErr(error);
  if (!row) throw new Error("Adjunto no encontrado.");

  const sheet = await fetchWorkerExpenseSheetById((row as WorkerExpenseSheetAttachmentRow).sheet_id);
  if (!sheet) throw new Error("Hoja no encontrada.");
  if (!canEditSheetAsWorker(profile, sheet.companyWorkerId)) {
    throw new Error("No puedes eliminar este adjunto.");
  }
  if (sheet.status !== "DRAFT" && sheet.status !== "REJECTED") {
    throw new Error("Solo se pueden eliminar adjuntos en borrador o en una hoja rechazada.");
  }

  const path = (row as WorkerExpenseSheetAttachmentRow).storage_path;
  const { error: delErr } = await sb.from("worker_expense_sheet_attachments").delete().eq("id", attachmentId);
  if (delErr) throwErr(delErr);
  await sb.storage.from(PROJECT_DOCUMENTS_BUCKET).remove([path]).catch(() => undefined);
}

export async function openExpenseSheetAttachmentDownload(attachment: WorkerExpenseSheetAttachmentRecord): Promise<void> {
  const url = await getProjectDocumentSignedUrl(attachment.storagePath, 3600);
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function rejectExpenseSheet(sheetId: string, reason: string): Promise<void> {
  const profile = await requireProfile();
  if (profile.role !== "ADMIN") throw new Error("Solo administración puede rechazar.");

  const r = reason.trim();
  if (!r) throw new Error("Indica el motivo del rechazo.");

  const sb = requireSupabase();
  const now = new Date().toISOString();
  const { error } = await sb
    .from("worker_expense_sheets")
    .update({
      status: "REJECTED",
      reviewed_by_backoffice_user_id: profile.id,
      reviewed_at: now,
      rejection_reason: r,
      updated_at: now,
    })
    .eq("id", sheetId)
    .eq("status", "SUBMITTED");
  if (error) throwErr(error);
}

export function computeLineTotal(amounts: WorkerExpenseLineAmounts): number {
  let t = 0;
  for (const k of WORKER_EXPENSE_CATEGORY_KEYS) t += amounts[k] ?? 0;
  return Math.round(t * 100) / 100;
}

export function computeSheetTotal(sheet: Pick<WorkerExpenseSheetRecord, "lines">): number {
  let t = 0;
  for (const line of sheet.lines) t += computeLineTotal(line.amounts);
  return Math.round(t * 100) / 100;
}

export function computeDailyTotalByDate(sheet: WorkerExpenseSheetRecord): Map<string, number> {
  const m = new Map<string, number>();
  for (const line of sheet.lines) {
    m.set(line.expenseDate, computeLineTotal(line.amounts));
  }
  return m;
}
