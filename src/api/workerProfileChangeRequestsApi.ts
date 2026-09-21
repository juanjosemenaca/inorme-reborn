import { requireSupabase } from "@/api/supabaseRequire";
import { createBackofficeMessage, createBackofficeMessagesToRecipients } from "@/api/backofficeMessagesApi";
import {
  fetchBackofficeUsers,
  getProfileByAuthUserId,
  syncBackofficeUserFromCompanyWorker,
} from "@/api/backofficeUsersApi";
import { getCompanyWorkerById, updateCompanyWorker } from "@/api/companyWorkersApi";
import { companyWorkerDisplayName } from "@/types/companyWorkers";
import type { WorkerProfileChangeRequestRow } from "@/types/database";
import type {
  WorkerPersonalDataSuggestion,
  WorkerProfileChangeRequestRecord,
} from "@/types/workerProfileChangeRequests";
import type { CompanyWorkerRecord } from "@/types/companyWorkers";

function rowToDomain(row: WorkerProfileChangeRequestRow): WorkerProfileChangeRequestRecord {
  return {
    id: row.id,
    companyWorkerId: row.company_worker_id,
    backofficeUserId: row.backoffice_user_id,
    status: row.status,
    workerMessage: row.worker_message,
    suggested: parseSuggestion(row.suggested),
    previousSnapshot: row.previous_snapshot ? parseSuggestion(row.previous_snapshot) : null,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseSuggestion(raw: Record<string, unknown>): WorkerPersonalDataSuggestion {
  const s = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : "");
  return {
    firstName: s("firstName"),
    lastName: s("lastName"),
    dni: s("dni"),
    email: s("email"),
    mobile: s("mobile"),
    postalAddress: s("postalAddress"),
    city: s("city"),
  };
}

const PROFILE_FIELD_LABELS: Record<keyof WorkerPersonalDataSuggestion, string> = {
  firstName: "Nombre",
  lastName: "Apellidos",
  dni: "DNI / NIE",
  email: "Email",
  mobile: "Teléfono",
  postalAddress: "Dirección",
  city: "Ciudad",
};

function formatProfileDiff(
  prev: WorkerPersonalDataSuggestion,
  next: WorkerPersonalDataSuggestion
): string {
  const keys = Object.keys(PROFILE_FIELD_LABELS) as (keyof WorkerPersonalDataSuggestion)[];
  const lines: string[] = [];
  for (const k of keys) {
    const a = (prev[k] ?? "").trim();
    const b = (next[k] ?? "").trim();
    if (a !== b) lines.push(`${PROFILE_FIELD_LABELS[k]}: ${a || "—"} → ${b || "—"}`);
  }
  return lines.length > 0 ? lines.map((l) => `- ${l}`).join("\n") : "—";
}

async function notifyAdminsOfProfileRequest(input: {
  requestId: string;
  workerName: string;
  previous: WorkerPersonalDataSuggestion;
  suggested: WorkerPersonalDataSuggestion;
  workerMessage: string;
}): Promise<void> {
  const admins = (await fetchBackofficeUsers()).filter((u) => u.role === "ADMIN" && u.active);
  const diffs = formatProfileDiff(input.previous, input.suggested);
  const extra = input.workerMessage
    ? `\n\nMensaje del trabajador:\n${input.workerMessage}`
    : "";
  try {
    await createBackofficeMessagesToRecipients(
      admins.map((a) => a.id),
      {
        category: "WORKER_PROFILE_CHANGE",
        title: "Solicitud de modificación de ficha",
        body: `${input.workerName} ha solicitado cambiar sus datos personales.\n\nCambios propuestos:\n${diffs}${extra}\n\nRevísalo en Usuarios → Solicitudes de ficha.`,
        payload: {
          kind: "worker_profile_change",
          requestId: input.requestId,
        },
      }
    );
  } catch (e) {
    console.error("[messages] No se pudo avisar a administración de la solicitud de ficha:", e);
  }
}

async function notifyWorkerOfProfileDecision(input: {
  workerBackofficeUserId: string;
  requestId: string;
  approved: boolean;
  rejectionReason?: string;
}): Promise<void> {
  try {
    await createBackofficeMessage(input.workerBackofficeUserId, {
      category: "WORKER_PROFILE_CHANGE",
      title: input.approved
        ? "Solicitud de ficha aceptada"
        : "Solicitud de ficha rechazada",
      body: input.approved
        ? "Administración ha aceptado tu solicitud de modificación de datos personales. Los datos nuevos ya están guardados en tu ficha."
        : `Administración ha rechazado tu solicitud de modificación de datos personales.\nMotivo: ${input.rejectionReason ?? "—"}`,
      payload: {
        kind: "worker_profile_change_result",
        requestId: input.requestId,
        approved: input.approved,
      },
    });
  } catch (e) {
    console.error("[messages] No se pudo avisar al trabajador del resultado de la ficha:", e);
  }
}

export function snapshotFromWorker(w: CompanyWorkerRecord): WorkerPersonalDataSuggestion {
  return {
    firstName: w.firstName,
    lastName: w.lastName,
    dni: w.dni,
    email: w.email,
    mobile: w.mobile,
    postalAddress: w.postalAddress,
    city: w.city,
  };
}

export async function fetchPendingWorkerProfileChangeRequests(): Promise<
  WorkerProfileChangeRequestRecord[]
> {
  const sb = requireSupabase();
  const { data: rows, error } = await sb
    .from("worker_profile_change_requests")
    .select("*")
    .eq("status", "PENDING")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (rows ?? []).map((r) => rowToDomain(r as WorkerProfileChangeRequestRow));
}

export async function fetchAllWorkerProfileChangeRequests(): Promise<
  WorkerProfileChangeRequestRecord[]
> {
  const sb = requireSupabase();
  const { data: rows, error } = await sb
    .from("worker_profile_change_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (rows ?? []).map((r) => rowToDomain(r as WorkerProfileChangeRequestRow));
}

export async function fetchWorkerProfileChangeRequestsForWorker(
  companyWorkerId: string
): Promise<WorkerProfileChangeRequestRecord[]> {
  const sb = requireSupabase();
  const { data: rows, error } = await sb
    .from("worker_profile_change_requests")
    .select("*")
    .eq("company_worker_id", companyWorkerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (rows ?? []).map((r) => rowToDomain(r as WorkerProfileChangeRequestRow));
}

export async function hasPendingWorkerProfileRequest(companyWorkerId: string): Promise<boolean> {
  const sb = requireSupabase();
  const { count, error } = await sb
    .from("worker_profile_change_requests")
    .select("id", { count: "exact", head: true })
    .eq("company_worker_id", companyWorkerId)
    .eq("status", "PENDING");
  if (error) throw error;
  return (count ?? 0) > 0;
}

export type SubmitWorkerProfileChangeInput = {
  suggested: WorkerPersonalDataSuggestion;
  workerMessage: string;
};

export async function submitWorkerProfileChangeRequest(
  input: SubmitWorkerProfileChangeInput
): Promise<void> {
  const sb = requireSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sesión no válida.");
  const profile = await getProfileByAuthUserId(user.id);
  if (!profile?.companyWorkerId) {
    throw new Error("Tu cuenta no tiene una ficha de trabajador vinculada.");
  }
  const workerId = profile.companyWorkerId;
  const pending = await hasPendingWorkerProfileRequest(workerId);
  if (pending) {
    throw new Error("Ya tienes una solicitud pendiente de revisión.");
  }
  const current = await getCompanyWorkerById(workerId);
  if (!current) throw new Error("No se encontró la ficha de trabajador.");
  const previous = snapshotFromWorker(current);
  const suggested = {
    firstName: input.suggested.firstName.trim(),
    lastName: input.suggested.lastName.trim(),
    dni: input.suggested.dni.trim().toUpperCase(),
    email: input.suggested.email.trim().toLowerCase(),
    mobile: input.suggested.mobile.trim(),
    postalAddress: input.suggested.postalAddress.trim(),
    city: input.suggested.city.trim(),
  };
  const unchanged =
    suggested.firstName === previous.firstName &&
    suggested.lastName === previous.lastName &&
    suggested.dni.replace(/\s/g, "") === previous.dni.replace(/\s/g, "") &&
    suggested.email === previous.email.trim().toLowerCase() &&
    suggested.mobile === previous.mobile &&
    suggested.postalAddress === previous.postalAddress &&
    suggested.city === previous.city;
  if (unchanged) {
    throw new Error("No hay cambios respecto a los datos actuales.");
  }
  const { data: inserted, error } = await sb
    .from("worker_profile_change_requests")
    .insert({
      company_worker_id: workerId,
      backoffice_user_id: profile.id,
      status: "PENDING",
      worker_message: input.workerMessage.trim(),
      suggested,
      previous_snapshot: previous,
    })
    .select("id")
    .single();
  if (error) throw error;
  await notifyAdminsOfProfileRequest({
    requestId: inserted.id,
    workerName: companyWorkerDisplayName(current),
    previous,
    suggested,
    workerMessage: input.workerMessage.trim(),
  });
}

export async function approveWorkerProfileChangeRequest(requestId: string): Promise<void> {
  const sb = requireSupabase();
  const { data: row, error: fetchErr } = await sb
    .from("worker_profile_change_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!row) throw new Error("Solicitud no encontrada.");
  const r = row as WorkerProfileChangeRequestRow;
  if (r.status !== "PENDING") throw new Error("La solicitud ya no está pendiente.");
  const suggested = parseSuggestion(r.suggested);
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sesión no válida.");
  const adminProfile = await getProfileByAuthUserId(user.id);
  if (!adminProfile || adminProfile.role !== "ADMIN") {
    throw new Error("Solo un administrador puede aprobar solicitudes.");
  }
  await updateCompanyWorker(r.company_worker_id, {
    firstName: suggested.firstName,
    lastName: suggested.lastName,
    dni: suggested.dni,
    email: suggested.email,
    mobile: suggested.mobile,
    postalAddress: suggested.postalAddress,
    city: suggested.city,
  });
  await syncBackofficeUserFromCompanyWorker(r.company_worker_id);
  const { error: upErr } = await sb
    .from("worker_profile_change_requests")
    .update({
      status: "APPROVED",
      reviewed_by: adminProfile.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq("id", requestId);
  if (upErr) throw upErr;
  await notifyWorkerOfProfileDecision({
    workerBackofficeUserId: r.backoffice_user_id,
    requestId,
    approved: true,
  });
}

export async function rejectWorkerProfileChangeRequest(
  requestId: string,
  rejectionReason: string
): Promise<void> {
  const sb = requireSupabase();
  const reason = rejectionReason.trim();
  if (!reason) throw new Error("Indica el motivo del rechazo.");
  const { data: row, error: fetchErr } = await sb
    .from("worker_profile_change_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!row) throw new Error("Solicitud no encontrada.");
  const r = row as WorkerProfileChangeRequestRow;
  if (r.status !== "PENDING") throw new Error("La solicitud ya no está pendiente.");
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sesión no válida.");
  const adminProfile = await getProfileByAuthUserId(user.id);
  if (!adminProfile || adminProfile.role !== "ADMIN") {
    throw new Error("Solo un administrador puede rechazar solicitudes.");
  }
  const { error } = await sb
    .from("worker_profile_change_requests")
    .update({
      status: "REJECTED",
      reviewed_by: adminProfile.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq("id", requestId);
  if (error) throw error;
  await notifyWorkerOfProfileDecision({
    workerBackofficeUserId: r.backoffice_user_id,
    requestId,
    approved: false,
    rejectionReason: reason,
  });
}

export async function deleteWorkerProfileChangeRequest(requestId: string): Promise<void> {
  const sb = requireSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sesión no válida.");
  const adminProfile = await getProfileByAuthUserId(user.id);
  if (!adminProfile || adminProfile.role !== "ADMIN") {
    throw new Error("Solo un administrador puede eliminar solicitudes.");
  }
  const { error } = await sb.from("worker_profile_change_requests").delete().eq("id", requestId);
  if (error) throw error;
}
