import { getProfileByAuthUserId } from "@/api/backofficeUsersApi";
import { createBackofficeMessage } from "@/api/backofficeMessagesApi";
import { getCompanyWorkerById } from "@/api/companyWorkersApi";
import { requireSupabase } from "@/api/supabaseRequire";
import { fetchWorkCalendarHolidays } from "@/api/workCalendarsApi";
import { isWeekendIso } from "@/lib/calendarIso";
import { getErrorMessage } from "@/lib/errorMessage";
import { isoDateOnlyFromDb, parseIsoDateYmdCalendar } from "@/lib/isoDate";
import type { WorkerVacationChangeRequestRow } from "@/types/database";
import type { WorkerVacationChangeRequestRecord } from "@/types/workerVacationChangeRequests";

function throwErr(error: unknown): never {
  throw new Error(getErrorMessage(error));
}

function parseDateArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const uniq = new Set<string>();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const t = isoDateOnlyFromDb(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) uniq.add(t);
  }
  return [...uniq].sort();
}

function rowToDomain(row: WorkerVacationChangeRequestRow): WorkerVacationChangeRequestRecord {
  return {
    id: row.id,
    companyWorkerId: row.company_worker_id,
    backofficeUserId: row.backoffice_user_id,
    calendarYear: row.calendar_year,
    status: row.status,
    workerMessage: row.worker_message,
    proposedDates: parseDateArray(row.proposed_dates),
    previousApprovedDates: parseDateArray(row.previous_approved_dates),
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchApprovedVacationDatesForWorkerYear(
  companyWorkerId: string,
  calendarYear: number
): Promise<string[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("company_worker_vacation_days")
    .select("vacation_date")
    .eq("company_worker_id", companyWorkerId)
    .gte("vacation_date", `${calendarYear}-01-01`)
    .lte("vacation_date", `${calendarYear}-12-31`)
    .order("vacation_date", { ascending: true });
  if (error) throwErr(error);
  return (data ?? []).map((r) => isoDateOnlyFromDb(String((r as { vacation_date: string }).vacation_date)));
}

export async function fetchPendingWorkerVacationChangeRequests(): Promise<
  WorkerVacationChangeRequestRecord[]
> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("worker_vacation_change_requests")
    .select("*")
    .eq("status", "PENDING")
    .order("created_at", { ascending: true });
  if (error) throwErr(error);
  return (data ?? []).map((r) => rowToDomain(r as WorkerVacationChangeRequestRow));
}

export async function fetchAllWorkerVacationChangeRequests(): Promise<
  WorkerVacationChangeRequestRecord[]
> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("worker_vacation_change_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throwErr(error);
  return (data ?? []).map((r) => rowToDomain(r as WorkerVacationChangeRequestRow));
}

export async function fetchWorkerVacationChangeRequestsForWorker(
  companyWorkerId: string
): Promise<WorkerVacationChangeRequestRecord[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("worker_vacation_change_requests")
    .select("*")
    .eq("company_worker_id", companyWorkerId)
    .order("created_at", { ascending: false });
  if (error) throwErr(error);
  return (data ?? []).map((r) => rowToDomain(r as WorkerVacationChangeRequestRow));
}

export async function hasPendingWorkerVacationRequest(
  companyWorkerId: string,
  calendarYear: number
): Promise<boolean> {
  const sb = requireSupabase();
  const { count, error } = await sb
    .from("worker_vacation_change_requests")
    .select("id", { count: "exact", head: true })
    .eq("company_worker_id", companyWorkerId)
    .eq("calendar_year", calendarYear)
    .eq("status", "PENDING");
  if (error) throwErr(error);
  return (count ?? 0) > 0;
}

export type SubmitWorkerVacationChangeInput = {
  calendarYear: number;
  proposedDates: string[];
  workerMessage?: string;
};

export async function submitWorkerVacationChangeRequest(
  input: SubmitWorkerVacationChangeInput
): Promise<void> {
  const sb = requireSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sesion no valida.");
  const profile = await getProfileByAuthUserId(user.id);
  if (!profile?.companyWorkerId) throw new Error("Tu cuenta no tiene una ficha de trabajador vinculada.");

  const workerId = profile.companyWorkerId;
  const year = input.calendarYear;
  if (year < 2000 || year > 2100) throw new Error("El ano debe estar entre 2000 y 2100.");

  const pending = await hasPendingWorkerVacationRequest(workerId, year);
  if (pending) throw new Error("Ya tienes una solicitud de vacaciones pendiente para este ano.");

  const worker = await getCompanyWorkerById(workerId);
  if (!worker) throw new Error("No se encontro la ficha de trabajador.");

  const approvedDates = await fetchApprovedVacationDatesForWorkerYear(workerId, year);
  const normalized = [...new Set(input.proposedDates.map((d) => parseIsoDateYmdCalendar(d).iso))].sort();
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
  for (const iso of normalized) {
    const parsed = parseIsoDateYmdCalendar(iso);
    if (parsed.year !== year) throw new Error("Todas las fechas propuestas deben pertenecer al ano seleccionado.");
  }

  const approvedPast = approvedDates.filter((d) => d < todayIso).sort();
  const proposedPast = normalized.filter((d) => d < todayIso).sort();
  const samePast =
    approvedPast.length === proposedPast.length &&
    approvedPast.every((d, idx) => d === proposedPast[idx]);
  if (!samePast) {
    throw new Error(
      "No puedes modificar vacaciones ya disfrutadas. Solo se permiten cambios desde hoy en adelante."
    );
  }

  if (normalized.length > worker.vacationDays) {
    throw new Error(`No puedes proponer mas de ${worker.vacationDays} dias de vacaciones.`);
  }

  const holidays = await fetchWorkCalendarHolidays(year);
  const holidaySet = new Set(
    holidays.filter((h) => h.siteId === worker.workCalendarSiteId).map((h) => isoDateOnlyFromDb(h.holidayDate))
  );
  for (const iso of normalized) {
    if (isWeekendIso(iso)) throw new Error("No puedes proponer vacaciones en fin de semana.");
    if (holidaySet.has(iso)) throw new Error("No puedes proponer vacaciones en un festivo.");
  }

  const same =
    normalized.length === approvedDates.length &&
    normalized.every((d, idx) => d === approvedDates[idx]);
  if (same) throw new Error("No hay cambios respecto a las vacaciones ya aprobadas.");

  const { error } = await sb.from("worker_vacation_change_requests").insert({
    company_worker_id: workerId,
    backoffice_user_id: profile.id,
    calendar_year: year,
    status: "PENDING",
    worker_message: (input.workerMessage ?? "").trim(),
    proposed_dates: normalized,
    previous_approved_dates: approvedDates,
  });
  if (error) throwErr(error);
}

export async function approveWorkerVacationChangeRequest(requestId: string): Promise<void> {
  const sb = requireSupabase();
  const { data: row, error: fetchErr } = await sb
    .from("worker_vacation_change_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (fetchErr) throwErr(fetchErr);
  if (!row) throw new Error("Solicitud no encontrada.");
  const req = row as WorkerVacationChangeRequestRow;
  if (req.status !== "PENDING") throw new Error("La solicitud ya no esta pendiente.");

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sesion no valida.");
  const adminProfile = await getProfileByAuthUserId(user.id);
  if (!adminProfile || adminProfile.role !== "ADMIN") {
    throw new Error("Solo un administrador puede aprobar solicitudes.");
  }

  const year = req.calendar_year;
  const proposed = parseDateArray(req.proposed_dates);

  const { error: delErr } = await sb
    .from("company_worker_vacation_days")
    .delete()
    .eq("company_worker_id", req.company_worker_id)
    .gte("vacation_date", `${year}-01-01`)
    .lte("vacation_date", `${year}-12-31`);
  if (delErr) throwErr(delErr);

  if (proposed.length > 0) {
    const { error: insErr } = await sb.from("company_worker_vacation_days").insert(
      proposed.map((d) => ({
        company_worker_id: req.company_worker_id,
        vacation_date: d,
      }))
    );
    if (insErr) throwErr(insErr);
  }

  const { error: upErr } = await sb
    .from("worker_vacation_change_requests")
    .update({
      status: "APPROVED",
      reviewed_by: adminProfile.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq("id", requestId);
  if (upErr) throwErr(upErr);
}

export async function rejectWorkerVacationChangeRequest(
  requestId: string,
  rejectionReason: string
): Promise<void> {
  const reason = rejectionReason.trim();
  if (!reason) throw new Error("Indica el motivo del rechazo.");

  const sb = requireSupabase();
  const { data: row, error: fetchErr } = await sb
    .from("worker_vacation_change_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (fetchErr) throwErr(fetchErr);
  if (!row) throw new Error("Solicitud no encontrada.");
  const req = row as WorkerVacationChangeRequestRow;
  if (req.status !== "PENDING") throw new Error("La solicitud ya no esta pendiente.");

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sesion no valida.");
  const adminProfile = await getProfileByAuthUserId(user.id);
  if (!adminProfile || adminProfile.role !== "ADMIN") {
    throw new Error("Solo un administrador puede rechazar solicitudes.");
  }

  const { error } = await sb
    .from("worker_vacation_change_requests")
    .update({
      status: "REJECTED",
      reviewed_by: adminProfile.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason,
      proposed_dates: [],
    })
    .eq("id", requestId);
  if (error) throwErr(error);

  try {
    await createBackofficeMessage(req.backoffice_user_id, {
      category: "VACATION_REQUEST",
      title: "Solicitud de vacaciones rechazada",
      body: `Tu solicitud de cambios de vacaciones para ${req.calendar_year} ha sido rechazada.\nMotivo: ${reason}`,
      payload: { requestId, calendarYear: req.calendar_year, rejectionReason: reason },
    });
  } catch (e) {
    console.error("[messages] No se pudo crear mensaje de rechazo de vacaciones:", e);
  }
}

export async function deleteWorkerVacationChangeRequest(requestId: string): Promise<void> {
  const sb = requireSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sesion no valida.");
  const adminProfile = await getProfileByAuthUserId(user.id);
  if (!adminProfile || adminProfile.role !== "ADMIN") {
    throw new Error("Solo un administrador puede eliminar solicitudes.");
  }
  const { error } = await sb.from("worker_vacation_change_requests").delete().eq("id", requestId);
  if (error) throwErr(error);
}
