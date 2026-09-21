import { requireSupabase } from "@/api/supabaseRequire";
import { createBackofficeMessage, createBackofficeMessagesToRecipients } from "@/api/backofficeMessagesApi";
import {
  fetchBackofficeUsers,
  getProfileByAuthUserId,
  updateWorkerModules,
} from "@/api/backofficeUsersApi";
import { getCompanyWorkerById } from "@/api/companyWorkersApi";
import { companyWorkerDisplayName } from "@/types/companyWorkers";
import type { WorkerModuleKey } from "@/types/backoffice";
import type { WorkerModuleChangeRequestRow } from "@/types/database";
import type { WorkerModuleChangeRequestRecord } from "@/types/workerModuleChangeRequests";
import {
  moduleListDiff,
  modulesEqual,
  normalizeModuleList,
} from "@/lib/workerModules";

const MODULE_NAME_ES: Record<WorkerModuleKey, string> = {
  VACATIONS: "Vacaciones",
  MESSAGES: "Mensajes",
  TIME_CLOCK: "Control de fichajes",
  AGENDA: "Agenda",
  GASTOS: "Gastos",
  FACTURACION: "Facturación",
  DMS: "Gestor documental",
  ADMIN_COMPANY_WORKERS: "Trabajadores (maestro)",
  ADMIN_CLIENTS: "Clientes (maestro)",
  ADMIN_PROJECTS: "Proyectos (maestro)",
  ADMIN_PROVIDERS: "Proveedores (maestro)",
};

function formatModuleNames(mods: WorkerModuleKey[]): string {
  if (mods.length === 0) return "—";
  return mods.map((m) => MODULE_NAME_ES[m] ?? m).join(", ");
}

function rowToDomain(row: WorkerModuleChangeRequestRow): WorkerModuleChangeRequestRecord {
  return {
    id: row.id,
    companyWorkerId: row.company_worker_id,
    backofficeUserId: row.backoffice_user_id,
    status: row.status,
    workerMessage: row.worker_message,
    previousModules: normalizeModuleList(row.previous_modules ?? []),
    suggestedModules: normalizeModuleList(row.suggested_modules ?? []),
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatModuleDiffText(previous: WorkerModuleKey[], suggested: WorkerModuleKey[]): string {
  const { added, removed } = moduleListDiff(previous, suggested);
  const lines: string[] = [];
  if (added.length) lines.push(`Activar: ${formatModuleNames(added)}`);
  if (removed.length) lines.push(`Desactivar: ${formatModuleNames(removed)}`);
  return lines.join("\n") || "Sin cambios de módulos.";
}

async function notifyAdminsOfModuleRequest(input: {
  requestId: string;
  workerName: string;
  previous: WorkerModuleKey[];
  suggested: WorkerModuleKey[];
  workerMessage: string;
}): Promise<void> {
  const admins = (await fetchBackofficeUsers()).filter((u) => u.role === "ADMIN" && u.active);
  const extra = input.workerMessage ? `\n\nMensaje del trabajador:\n${input.workerMessage}` : "";
  try {
    await createBackofficeMessagesToRecipients(
      admins.map((a) => a.id),
      {
        category: "WORKER_MODULE_CHANGE",
        title: "Solicitud de cambio de módulos",
        body: `${input.workerName} ha solicitado cambiar sus módulos y funcionalidades.\n\n${formatModuleDiffText(input.previous, input.suggested)}${extra}\n\nRevísalo en Usuarios → Solicitudes de ficha.`,
        payload: {
          kind: "worker_module_change",
          requestId: input.requestId,
        },
      }
    );
  } catch (e) {
    console.error("[messages] No se pudo avisar a administración del cambio de módulos:", e);
  }
}

async function notifyWorkerOfModuleDecision(input: {
  workerBackofficeUserId: string;
  requestId: string;
  approved: boolean;
  previous: WorkerModuleKey[];
  suggested: WorkerModuleKey[];
  rejectionReason?: string;
}): Promise<void> {
  try {
    await createBackofficeMessage(input.workerBackofficeUserId, {
      category: "WORKER_MODULE_CHANGE",
      title: input.approved ? "Solicitud de módulos aceptada" : "Solicitud de módulos rechazada",
      body: input.approved
        ? `Administración ha aceptado tu solicitud de cambio de módulos.\n${formatModuleDiffText(input.previous, input.suggested)}`
        : `Administración ha rechazado tu solicitud de cambio de módulos.\nMotivo: ${input.rejectionReason ?? "—"}`,
      payload: {
        kind: "worker_module_change_result",
        requestId: input.requestId,
        approved: input.approved,
      },
    });
  } catch (e) {
    console.error("[messages] No se pudo avisar al trabajador del resultado de módulos:", e);
  }
}

export async function fetchAllWorkerModuleChangeRequests(): Promise<
  WorkerModuleChangeRequestRecord[]
> {
  const sb = requireSupabase();
  const { data: rows, error } = await sb
    .from("worker_module_change_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (rows ?? []).map((r) => rowToDomain(r as WorkerModuleChangeRequestRow));
}

export async function fetchPendingWorkerModuleChangeRequests(): Promise<
  WorkerModuleChangeRequestRecord[]
> {
  const sb = requireSupabase();
  const { data: rows, error } = await sb
    .from("worker_module_change_requests")
    .select("*")
    .eq("status", "PENDING")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (rows ?? []).map((r) => rowToDomain(r as WorkerModuleChangeRequestRow));
}

export async function fetchWorkerModuleChangeRequestsForWorker(
  companyWorkerId: string
): Promise<WorkerModuleChangeRequestRecord[]> {
  const sb = requireSupabase();
  const { data: rows, error } = await sb
    .from("worker_module_change_requests")
    .select("*")
    .eq("company_worker_id", companyWorkerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (rows ?? []).map((r) => rowToDomain(r as WorkerModuleChangeRequestRow));
}

export async function hasPendingWorkerModuleRequest(companyWorkerId: string): Promise<boolean> {
  const sb = requireSupabase();
  const { count, error } = await sb
    .from("worker_module_change_requests")
    .select("id", { count: "exact", head: true })
    .eq("company_worker_id", companyWorkerId)
    .eq("status", "PENDING");
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function submitWorkerModuleChangeRequest(input: {
  suggestedModules: WorkerModuleKey[];
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
  if (await hasPendingWorkerModuleRequest(workerId)) {
    throw new Error("Ya tienes una solicitud de módulos pendiente de revisión.");
  }
  const current = await getCompanyWorkerById(workerId);
  if (!current) throw new Error("No se encontró la ficha de trabajador.");
  const previous = normalizeModuleList(profile.enabledModules ?? []);
  const suggested = normalizeModuleList(input.suggestedModules);
  if (modulesEqual(previous, suggested)) {
    throw new Error("No hay cambios respecto a los módulos actuales.");
  }

  const { data: inserted, error } = await sb
    .from("worker_module_change_requests")
    .insert({
      company_worker_id: workerId,
      backoffice_user_id: profile.id,
      status: "PENDING",
      worker_message: input.workerMessage.trim(),
      previous_modules: previous,
      suggested_modules: suggested,
    })
    .select("id")
    .single();
  if (error) throw error;

  await notifyAdminsOfModuleRequest({
    requestId: inserted.id,
    workerName: companyWorkerDisplayName(current),
    previous,
    suggested,
    workerMessage: input.workerMessage.trim(),
  });
}

export async function approveWorkerModuleChangeRequest(requestId: string): Promise<void> {
  const sb = requireSupabase();
  const { data: row, error: fetchErr } = await sb
    .from("worker_module_change_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!row) throw new Error("Solicitud no encontrada.");
  const r = row as WorkerModuleChangeRequestRow;
  if (r.status !== "PENDING") throw new Error("La solicitud ya no está pendiente.");
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sesión no válida.");
  const adminProfile = await getProfileByAuthUserId(user.id);
  if (!adminProfile || adminProfile.role !== "ADMIN") {
    throw new Error("Solo un administrador puede aprobar solicitudes.");
  }

  const suggested = normalizeModuleList(r.suggested_modules ?? []);
  await updateWorkerModules(r.backoffice_user_id, suggested);

  const { error: upErr } = await sb
    .from("worker_module_change_requests")
    .update({
      status: "APPROVED",
      reviewed_by: adminProfile.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq("id", requestId);
  if (upErr) throw upErr;

  await notifyWorkerOfModuleDecision({
    workerBackofficeUserId: r.backoffice_user_id,
    requestId,
    approved: true,
    previous: normalizeModuleList(r.previous_modules ?? []),
    suggested,
  });
}

export async function rejectWorkerModuleChangeRequest(
  requestId: string,
  rejectionReason: string
): Promise<void> {
  const reason = rejectionReason.trim();
  if (!reason) throw new Error("Indica el motivo del rechazo.");
  const sb = requireSupabase();
  const { data: row, error: fetchErr } = await sb
    .from("worker_module_change_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!row) throw new Error("Solicitud no encontrada.");
  const r = row as WorkerModuleChangeRequestRow;
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
    .from("worker_module_change_requests")
    .update({
      status: "REJECTED",
      reviewed_by: adminProfile.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq("id", requestId);
  if (error) throw error;

  await notifyWorkerOfModuleDecision({
    workerBackofficeUserId: r.backoffice_user_id,
    requestId,
    approved: false,
    previous: normalizeModuleList(r.previous_modules ?? []),
    suggested: normalizeModuleList(r.suggested_modules ?? []),
    rejectionReason: reason,
  });
}

export async function deleteWorkerModuleChangeRequest(requestId: string): Promise<void> {
  const sb = requireSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sesión no válida.");
  const adminProfile = await getProfileByAuthUserId(user.id);
  if (!adminProfile || adminProfile.role !== "ADMIN") {
    throw new Error("Solo un administrador puede eliminar solicitudes.");
  }
  const { error } = await sb.from("worker_module_change_requests").delete().eq("id", requestId);
  if (error) throw error;
}
