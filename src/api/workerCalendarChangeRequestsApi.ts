import { requireSupabase } from "@/api/supabaseRequire";
import { createBackofficeMessage, createBackofficeMessagesToRecipients } from "@/api/backofficeMessagesApi";
import {
  fetchBackofficeUsers,
  getProfileByAuthUserId,
} from "@/api/backofficeUsersApi";
import { applyWorkCalendarSiteToWorker, getCompanyWorkerById } from "@/api/companyWorkersApi";
import { getWorkCalendarSiteById } from "@/api/workCalendarSitesApi";
import { companyWorkerDisplayName } from "@/types/companyWorkers";
import type { WorkerCalendarChangeRequestRow } from "@/types/database";
import type { WorkerCalendarChangeRequestRecord } from "@/types/workerCalendarChangeRequests";

function rowToDomain(row: WorkerCalendarChangeRequestRow): WorkerCalendarChangeRequestRecord {
  return {
    id: row.id,
    companyWorkerId: row.company_worker_id,
    backofficeUserId: row.backoffice_user_id,
    status: row.status,
    workerMessage: row.worker_message,
    previousSiteId: row.previous_site_id,
    suggestedSiteId: row.suggested_site_id,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function siteName(id: string): Promise<string> {
  const site = await getWorkCalendarSiteById(id);
  return site?.name ?? id;
}

async function notifyAdminsOfCalendarRequest(input: {
  requestId: string;
  workerName: string;
  previousName: string;
  suggestedName: string;
  workerMessage: string;
}): Promise<void> {
  const admins = (await fetchBackofficeUsers()).filter((u) => u.role === "ADMIN" && u.active);
  const extra = input.workerMessage
    ? `\n\nMensaje del trabajador:\n${input.workerMessage}`
    : "";
  try {
    await createBackofficeMessagesToRecipients(
      admins.map((a) => a.id),
      {
        category: "WORKER_CALENDAR_CHANGE",
        title: "Solicitud de cambio de calendario laboral",
        body: `${input.workerName} ha solicitado cambiar su calendario laboral.\n\nCalendario actual: ${input.previousName}\nCalendario solicitado: ${input.suggestedName}${extra}\n\nRevísalo en Usuarios → Solicitudes de ficha.`,
        payload: {
          kind: "worker_calendar_change",
          requestId: input.requestId,
        },
      }
    );
  } catch (e) {
    console.error("[messages] No se pudo avisar a administración del cambio de calendario:", e);
  }
}

async function notifyWorkerOfCalendarDecision(input: {
  workerBackofficeUserId: string;
  requestId: string;
  approved: boolean;
  previousName: string;
  suggestedName: string;
  rejectionReason?: string;
}): Promise<void> {
  try {
    await createBackofficeMessage(input.workerBackofficeUserId, {
      category: "WORKER_CALENDAR_CHANGE",
      title: input.approved
        ? "Solicitud de calendario aceptada"
        : "Solicitud de calendario rechazada",
      body: input.approved
        ? `Administración ha aceptado tu solicitud de cambio de calendario laboral.\nNuevo calendario: ${input.suggestedName} (antes: ${input.previousName}).`
        : `Administración ha rechazado tu solicitud de cambio de calendario laboral (${input.previousName} → ${input.suggestedName}).\nMotivo: ${input.rejectionReason ?? "—"}`,
      payload: {
        kind: "worker_calendar_change_result",
        requestId: input.requestId,
        approved: input.approved,
      },
    });
  } catch (e) {
    console.error("[messages] No se pudo avisar al trabajador del resultado de calendario:", e);
  }
}

export async function fetchAllWorkerCalendarChangeRequests(): Promise<
  WorkerCalendarChangeRequestRecord[]
> {
  const sb = requireSupabase();
  const { data: rows, error } = await sb
    .from("worker_calendar_change_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (rows ?? []).map((r) => rowToDomain(r as WorkerCalendarChangeRequestRow));
}

export async function fetchPendingWorkerCalendarChangeRequests(): Promise<
  WorkerCalendarChangeRequestRecord[]
> {
  const sb = requireSupabase();
  const { data: rows, error } = await sb
    .from("worker_calendar_change_requests")
    .select("*")
    .eq("status", "PENDING")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (rows ?? []).map((r) => rowToDomain(r as WorkerCalendarChangeRequestRow));
}

export async function fetchWorkerCalendarChangeRequestsForWorker(
  companyWorkerId: string
): Promise<WorkerCalendarChangeRequestRecord[]> {
  const sb = requireSupabase();
  const { data: rows, error } = await sb
    .from("worker_calendar_change_requests")
    .select("*")
    .eq("company_worker_id", companyWorkerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (rows ?? []).map((r) => rowToDomain(r as WorkerCalendarChangeRequestRow));
}

export async function hasPendingWorkerCalendarRequest(companyWorkerId: string): Promise<boolean> {
  const sb = requireSupabase();
  const { count, error } = await sb
    .from("worker_calendar_change_requests")
    .select("id", { count: "exact", head: true })
    .eq("company_worker_id", companyWorkerId)
    .eq("status", "PENDING");
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function submitWorkerCalendarChangeRequest(input: {
  suggestedSiteId: string;
  workerMessage: string;
}): Promise<void> {
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
  if (await hasPendingWorkerCalendarRequest(workerId)) {
    throw new Error("Ya tienes una solicitud de calendario pendiente de revisión.");
  }
  const current = await getCompanyWorkerById(workerId);
  if (!current) throw new Error("No se encontró la ficha de trabajador.");
  const suggestedSiteId = input.suggestedSiteId.trim();
  if (!suggestedSiteId) throw new Error("Selecciona un calendario.");
  if (suggestedSiteId === current.workCalendarSiteId) {
    throw new Error("No hay cambios respecto al calendario actual.");
  }
  const suggestedSite = await getWorkCalendarSiteById(suggestedSiteId);
  if (!suggestedSite) throw new Error("Calendario no encontrado.");
  const previousSite = await getWorkCalendarSiteById(current.workCalendarSiteId);

  const { data: inserted, error } = await sb
    .from("worker_calendar_change_requests")
    .insert({
      company_worker_id: workerId,
      backoffice_user_id: profile.id,
      status: "PENDING",
      worker_message: input.workerMessage.trim(),
      previous_site_id: current.workCalendarSiteId,
      suggested_site_id: suggestedSiteId,
    })
    .select("id")
    .single();
  if (error) throw error;

  await notifyAdminsOfCalendarRequest({
    requestId: inserted.id,
    workerName: companyWorkerDisplayName(current),
    previousName: previousSite?.name ?? current.workCalendarSiteId,
    suggestedName: suggestedSite.name,
    workerMessage: input.workerMessage.trim(),
  });
}

export async function approveWorkerCalendarChangeRequest(requestId: string): Promise<void> {
  const sb = requireSupabase();
  const { data: row, error: fetchErr } = await sb
    .from("worker_calendar_change_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!row) throw new Error("Solicitud no encontrada.");
  const r = row as WorkerCalendarChangeRequestRow;
  if (r.status !== "PENDING") throw new Error("La solicitud ya no está pendiente.");
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sesión no válida.");
  const adminProfile = await getProfileByAuthUserId(user.id);
  if (!adminProfile || adminProfile.role !== "ADMIN") {
    throw new Error("Solo un administrador puede aprobar solicitudes.");
  }

  await applyWorkCalendarSiteToWorker(r.company_worker_id, r.suggested_site_id);

  const { error: upErr } = await sb
    .from("worker_calendar_change_requests")
    .update({
      status: "APPROVED",
      reviewed_by: adminProfile.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq("id", requestId);
  if (upErr) throw upErr;

  const previousName = await siteName(r.previous_site_id);
  const suggestedName = await siteName(r.suggested_site_id);
  await notifyWorkerOfCalendarDecision({
    workerBackofficeUserId: r.backoffice_user_id,
    requestId,
    approved: true,
    previousName,
    suggestedName,
  });
}

export async function rejectWorkerCalendarChangeRequest(
  requestId: string,
  rejectionReason: string
): Promise<void> {
  const reason = rejectionReason.trim();
  if (!reason) throw new Error("Indica el motivo del rechazo.");
  const sb = requireSupabase();
  const { data: row, error: fetchErr } = await sb
    .from("worker_calendar_change_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!row) throw new Error("Solicitud no encontrada.");
  const r = row as WorkerCalendarChangeRequestRow;
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
    .from("worker_calendar_change_requests")
    .update({
      status: "REJECTED",
      reviewed_by: adminProfile.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq("id", requestId);
  if (error) throw error;

  const previousName = await siteName(r.previous_site_id);
  const suggestedName = await siteName(r.suggested_site_id);
  await notifyWorkerOfCalendarDecision({
    workerBackofficeUserId: r.backoffice_user_id,
    requestId,
    approved: false,
    previousName,
    suggestedName,
    rejectionReason: reason,
  });
}

export async function deleteWorkerCalendarChangeRequest(requestId: string): Promise<void> {
  const sb = requireSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sesión no válida.");
  const adminProfile = await getProfileByAuthUserId(user.id);
  if (!adminProfile || adminProfile.role !== "ADMIN") {
    throw new Error("Solo un administrador puede eliminar solicitudes.");
  }
  const { error } = await sb.from("worker_calendar_change_requests").delete().eq("id", requestId);
  if (error) throw error;
}
