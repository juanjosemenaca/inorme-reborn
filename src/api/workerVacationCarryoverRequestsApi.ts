import { getProfileByAuthUserId } from "@/api/backofficeUsersApi";
import { getCompanyWorkerById } from "@/api/companyWorkersApi";
import { requireSupabase } from "@/api/supabaseRequire";
import { getErrorMessage } from "@/lib/errorMessage";
import type { WorkerVacationCarryoverRequestRow } from "@/types/database";
import { isoDateOnlyFromDb } from "@/lib/isoDate";

function throwErr(error: unknown): never {
  throw new Error(getErrorMessage(error));
}

export type WorkerVacationCarryoverRequestRecord = {
  id: string;
  companyWorkerId: string;
  backofficeUserId: string;
  sourceYear: number;
  targetYear: number;
  daysRequested: number;
  daysApproved: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  workerMessage: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

function rowToRecord(row: WorkerVacationCarryoverRequestRow): WorkerVacationCarryoverRequestRecord {
  return {
    id: row.id,
    companyWorkerId: row.company_worker_id,
    backofficeUserId: row.backoffice_user_id,
    sourceYear: row.source_year,
    targetYear: row.target_year,
    daysRequested: row.days_requested,
    daysApproved: row.days_approved,
    status: row.status,
    workerMessage: row.worker_message,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Días de cupo anual usados en source_year (sin contar traspasos, que viven en target_year). */
export async function countStandardVacationDaysInYear(
  companyWorkerId: string,
  year: number
): Promise<number> {
  const sb = requireSupabase();
  const { count, error } = await sb
    .from("company_worker_vacation_days")
    .select("id", { count: "exact", head: true })
    .eq("company_worker_id", companyWorkerId)
    .is("carryover_from_year", null)
    .gte("vacation_date", `${year}-01-01`)
    .lte("vacation_date", `${year}-12-31`);
  if (error) throwErr(error);
  return count ?? 0;
}

export async function getUnusedStandardDaysInYear(
  companyWorkerId: string,
  sourceYear: number,
  annualAllowance: number
): Promise<number> {
  const used = await countStandardVacationDaysInYear(companyWorkerId, sourceYear);
  return Math.max(0, annualAllowance - used);
}

/**
 * Días aprobados para traspaso source_year → target_year (solo APPROVED).
 */
export async function fetchApprovedCarryoverAllowance(
  companyWorkerId: string,
  targetYear: number,
  sourceYear: number
): Promise<number> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("worker_vacation_carryover_requests")
    .select("days_approved")
    .eq("company_worker_id", companyWorkerId)
    .eq("target_year", targetYear)
    .eq("source_year", sourceYear)
    .eq("status", "APPROVED")
    .maybeSingle();
  if (error) throwErr(error);
  if (!data) return 0;
  const n = (data as { days_approved: number | null }).days_approved;
  return typeof n === "number" && n > 0 ? n : 0;
}

/**
 * Días de traspaso ya marcados en target_year y procedentes de source_year.
 */
export async function countCarryoverDaysUsedInTarget(
  companyWorkerId: string,
  targetYear: number,
  sourceYear: number
): Promise<number> {
  const sb = requireSupabase();
  const { count, error } = await sb
    .from("company_worker_vacation_days")
    .select("id", { count: "exact", head: true })
    .eq("company_worker_id", companyWorkerId)
    .eq("carryover_from_year", sourceYear)
    .gte("vacation_date", `${targetYear}-01-01`)
    .lte("vacation_date", `${targetYear}-12-31`);
  if (error) throwErr(error);
  return count ?? 0;
}

export async function fetchMyCarryoverRequests(): Promise<WorkerVacationCarryoverRequestRecord[]> {
  const sb = requireSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sesión no válida.");
  const profile = await getProfileByAuthUserId(user.id);
  if (!profile?.companyWorkerId) throw new Error("No hay ficha de trabajador vinculada.");
  const { data, error } = await sb
    .from("worker_vacation_carryover_requests")
    .select("*")
    .eq("company_worker_id", profile.companyWorkerId)
    .order("created_at", { ascending: false });
  if (error) throwErr(error);
  return (data ?? []).map((r) => rowToRecord(r as WorkerVacationCarryoverRequestRow));
}

export async function fetchAllCarryoverRequests(): Promise<WorkerVacationCarryoverRequestRecord[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("worker_vacation_carryover_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throwErr(error);
  return (data ?? []).map((r) => rowToRecord(r as WorkerVacationCarryoverRequestRow));
}

export async function fetchPendingCarryoverRequests(): Promise<WorkerVacationCarryoverRequestRecord[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("worker_vacation_carryover_requests")
    .select("*")
    .eq("status", "PENDING")
    .order("created_at", { ascending: true });
  if (error) throwErr(error);
  return (data ?? []).map((r) => rowToRecord(r as WorkerVacationCarryoverRequestRow));
}

export type SubmitCarryoverRequestInput = {
  sourceYear: number;
  targetYear: number;
  daysRequested: number;
  workerMessage?: string;
};

export async function submitCarryoverRequest(input: SubmitCarryoverRequestInput): Promise<void> {
  const sb = requireSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sesión no válida.");
  const profile = await getProfileByAuthUserId(user.id);
  if (!profile?.companyWorkerId) throw new Error("No hay ficha de trabajador vinculada.");

  const { sourceYear, targetYear, daysRequested } = input;
  if (targetYear !== sourceYear + 1) {
    throw new Error("El traspaso debe ser al año natural siguiente.");
  }
  if (daysRequested < 1) throw new Error("Indica al menos un día.");
  if (sourceYear < 2000 || sourceYear > 2100) throw new Error("Año no válido.");

  const worker = await getCompanyWorkerById(profile.companyWorkerId);
  if (!worker) throw new Error("Trabajador no encontrado.");
  const unused = await getUnusedStandardDaysInYear(
    profile.companyWorkerId,
    sourceYear,
    worker.vacationDays
  );
  if (daysRequested > unused) {
    throw new Error(
      `Solo puedes solicitar hasta ${unused} días (no disfrutados de ${sourceYear} según el cupo y lo ya marcado).`
    );
  }

  const { data: blockers } = await sb
    .from("worker_vacation_carryover_requests")
    .select("status")
    .eq("company_worker_id", profile.companyWorkerId)
    .eq("source_year", sourceYear)
    .eq("target_year", targetYear)
    .in("status", ["PENDING", "APPROVED"]);
  const st = (blockers ?? [])[0] as { status: string } | undefined;
  if (st?.status === "PENDING") {
    throw new Error("Ya tienes una solicitud de traspaso pendiente para esos años.");
  }
  if (st?.status === "APPROVED") {
    throw new Error("Ya tienes aprobado un traspaso para esos años.");
  }

  const { error } = await sb.from("worker_vacation_carryover_requests").insert({
    company_worker_id: profile.companyWorkerId,
    backoffice_user_id: profile.id,
    source_year: sourceYear,
    target_year: targetYear,
    days_requested: daysRequested,
    status: "PENDING",
    worker_message: (input.workerMessage ?? "").trim(),
  });
  if (error) throwErr(error);
}

export async function approveCarryoverRequest(requestId: string, daysApproved: number): Promise<void> {
  if (!Number.isFinite(daysApproved) || daysApproved < 0) {
    throw new Error("Días aprobados no válidos.");
  }
  const sb = requireSupabase();
  const { data: row, error: fetchErr } = await sb
    .from("worker_vacation_carryover_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (fetchErr) throwErr(fetchErr);
  if (!row) throw new Error("Solicitud no encontrada.");
  const req = row as WorkerVacationCarryoverRequestRow;
  if (req.status !== "PENDING") throw new Error("La solicitud ya no está pendiente.");
  if (daysApproved > req.days_requested) {
    throw new Error("No puedes aprobar más días de los solicitados.");
  }

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sesión no válida.");
  const admin = await getProfileByAuthUserId(user.id);
  if (!admin || admin.role !== "ADMIN") {
    throw new Error("Solo un administrador puede aprobar.");
  }

  const { error: upErr } = await sb
    .from("worker_vacation_carryover_requests")
    .update({
      status: "APPROVED",
      days_approved: daysApproved,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq("id", requestId);
  if (upErr) throwErr(upErr);
}

export async function rejectCarryoverRequest(requestId: string, reason: string): Promise<void> {
  const r = reason.trim();
  if (!r) throw new Error("Indica el motivo del rechazo.");
  const sb = requireSupabase();
  const { data: row, error: fetchErr } = await sb
    .from("worker_vacation_carryover_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (fetchErr) throwErr(fetchErr);
  if (!row) throw new Error("Solicitud no encontrada.");
  const req = row as WorkerVacationCarryoverRequestRow;
  if (req.status !== "PENDING") throw new Error("La solicitud ya no está pendiente.");

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sesión no válida.");
  const admin = await getProfileByAuthUserId(user.id);
  if (!admin || admin.role !== "ADMIN") {
    throw new Error("Solo un administrador puede rechazar.");
  }

  const { error } = await sb
    .from("worker_vacation_carryover_requests")
    .update({
      status: "REJECTED",
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: r,
    })
    .eq("id", requestId);
  if (error) throwErr(error);
}

export async function deleteCarryoverRequest(requestId: string): Promise<void> {
  const sb = requireSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sesión no válida.");
  const admin = await getProfileByAuthUserId(user.id);
  if (!admin || admin.role !== "ADMIN") {
    throw new Error("Solo un administrador puede eliminar la solicitud.");
  }
  const { error } = await sb
    .from("worker_vacation_carryover_requests")
    .delete()
    .eq("id", requestId);
  if (error) throwErr(error);
}
