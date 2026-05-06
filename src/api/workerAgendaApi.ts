import { getProfileByAuthUserId } from "@/api/backofficeUsersApi";
import { createBackofficeMessage } from "@/api/backofficeMessagesApi";
import { getCompanyWorkerById } from "@/api/companyWorkersApi";
import { requireSupabase } from "@/api/supabaseRequire";
import { getErrorMessage } from "@/lib/errorMessage";
import type { WorkerAgendaItemRow } from "@/types/database";
import type {
  WorkerAgendaItemRecord,
  WorkerAgendaItemSource,
  WorkerAgendaItemType,
} from "@/types/agenda";
import { ADMIN_WORKER_AGENDA_CREATE_TYPES, WORKER_AGENDA_ITEM_TYPES } from "@/types/agenda";

function throwErr(e: unknown): never {
  throw new Error(getErrorMessage(e));
}

function rowToDomain(row: WorkerAgendaItemRow): WorkerAgendaItemRecord {
  return {
    id: row.id,
    companyWorkerId: row.company_worker_id,
    appliesToAllCompanyWorkers: row.applies_to_all_company_workers ?? false,
    projectId: row.project_id ?? null,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    itemType: row.item_type as WorkerAgendaItemType,
    source: row.source as WorkerAgendaItemSource,
    createdByBackofficeUserId: row.created_by_backoffice_user_id,
    completedAt: row.completed_at ?? null,
    completedByBackofficeUserId: row.completed_by_backoffice_user_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

const workerTypeSet = new Set<WorkerAgendaItemType>(WORKER_AGENDA_ITEM_TYPES);
const adminCreateTypeSet = new Set<WorkerAgendaItemType>(ADMIN_WORKER_AGENDA_CREATE_TYPES);

async function listProjectIdsForCompanyWorker(companyWorkerId: string): Promise<string[]> {
  const sb = requireSupabase();
  const ids = new Set<string>();
  const { data: asResponsible, error: e1 } = await sb
    .from("projects")
    .select("id")
    .eq("responsible_company_worker_id", companyWorkerId);
  if (e1) throwErr(e1);
  for (const r of asResponsible ?? []) ids.add((r as { id: string }).id);

  const { data: asMember, error: e2 } = await sb
    .from("project_members")
    .select("project_id")
    .eq("company_worker_id", companyWorkerId);
  if (e2) {
    const msg = getErrorMessage(e2).toLowerCase();
    if (
      msg.includes("schema cache") ||
      msg.includes("does not exist") ||
      (msg.includes("project_members") && msg.includes("could not find"))
    ) {
      /* sin miembros visibles vía REST */
    } else {
      throwErr(e2);
    }
  } else {
    for (const r of asMember ?? []) ids.add((r as { project_id: string }).project_id);
  }
  return [...ids];
}

/** Rango [fromIso, toIso] fechas inclusive en calendario local; convierte a consulta por timestamptz. */
export async function fetchWorkerAgendaItems(
  companyWorkerId: string,
  fromIsoDate: string,
  toIsoDate: string
): Promise<WorkerAgendaItemRecord[]> {
  const sb = requireSupabase();
  const profile = await requireProfile();
  if (profile.role === "WORKER") {
    if (profile.companyWorkerId !== companyWorkerId) {
      throw new Error("No puedes consultar la agenda de otro trabajador.");
    }
  } else if (profile.role !== "ADMIN") {
    throw new Error("Sin permiso.");
  }

  const start = `${fromIsoDate}T00:00:00.000Z`;
  const endNext = new Date(`${toIsoDate}T23:59:59.999Z`);
  const end = endNext.toISOString();

  const projectIds = await listProjectIdsForCompanyWorker(companyWorkerId);
  const orParts = [`company_worker_id.eq.${companyWorkerId}`, `applies_to_all_company_workers.eq.true`];
  if (projectIds.length > 0) {
    orParts.push(`project_id.in.(${projectIds.join(",")})`);
  }

  const { data, error } = await sb
    .from("worker_agenda_items")
    .select("*")
    .or(orParts.join(","))
    .gte("starts_at", start)
    .lte("starts_at", end)
    .order("starts_at", { ascending: true });

  if (error) throwErr(error);
  return (data ?? []).map((r) => rowToDomain(r as WorkerAgendaItemRow));
}

export type CreateWorkerAgendaItemInput = {
  companyWorkerId?: string;
  appliesToAllCompanyWorkers?: boolean;
  projectId?: string | null;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt?: string | null;
  itemType: WorkerAgendaItemType;
};

export async function createWorkerAgendaItem(input: CreateWorkerAgendaItemInput): Promise<WorkerAgendaItemRecord> {
  const sb = requireSupabase();
  const profile = await requireProfile();

  let source: WorkerAgendaItemSource = "WORKER";
  const itemType = input.itemType;
  const appliesToAll = input.appliesToAllCompanyWorkers === true;
  const projectIdRaw = input.projectId?.trim() || null;

  if (appliesToAll && projectIdRaw) {
    throw new Error("Elige solo un alcance: todos los trabajadores o un proyecto.");
  }
  if (appliesToAll && input.companyWorkerId) {
    throw new Error("Una entrada para todos no debe incluir un trabajador concreto.");
  }
  if (projectIdRaw && input.companyWorkerId) {
    throw new Error("Una entrada de proyecto no debe incluir un trabajador concreto en la fila.");
  }

  if (appliesToAll) {
    if (profile.role !== "ADMIN") {
      throw new Error("Solo administración puede crear entradas para todos los trabajadores.");
    }
    if (itemType === "todo") {
      throw new Error(
        "Las tareas (to-do) no pueden aplicarse a todos los trabajadores. Usa una nota o un evento."
      );
    }
    source = "ADMIN";
    if (!adminCreateTypeSet.has(itemType)) {
      throw new Error("Tipo de entrada no permitido para administración.");
    }

    const { data, error } = await sb
      .from("worker_agenda_items")
      .insert({
        company_worker_id: null,
        applies_to_all_company_workers: true,
        project_id: null,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        starts_at: input.startsAt,
        ends_at: input.endsAt ?? null,
        item_type: itemType,
        source,
        created_by_backoffice_user_id: profile.id,
      })
      .select("*")
      .single();

    if (error) throwErr(error);
    return rowToDomain(data as WorkerAgendaItemRow);
  }

  if (projectIdRaw) {
    if (profile.role !== "ADMIN") {
      throw new Error("Solo administración puede crear entradas ligadas a un proyecto.");
    }
    if (itemType === "todo") {
      throw new Error(
        "Las tareas (to-do) no pueden ligarse a un proyecto en bloque. Crea un to-do en la agenda de una persona."
      );
    }
    source = "ADMIN";
    if (!adminCreateTypeSet.has(itemType)) {
      throw new Error("Tipo de entrada no permitido para administración.");
    }

    const { data, error } = await sb
      .from("worker_agenda_items")
      .insert({
        company_worker_id: null,
        applies_to_all_company_workers: false,
        project_id: projectIdRaw,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        starts_at: input.startsAt,
        ends_at: input.endsAt ?? null,
        item_type: itemType,
        source,
        created_by_backoffice_user_id: profile.id,
      })
      .select("*")
      .single();

    if (error) throwErr(error);
    return rowToDomain(data as WorkerAgendaItemRow);
  }

  const companyWorkerId = input.companyWorkerId;
  if (!companyWorkerId) {
    throw new Error("Falta el trabajador de la agenda.");
  }

  if (profile.role === "ADMIN") {
    source = "ADMIN";
    if (!adminCreateTypeSet.has(itemType)) {
      throw new Error("Tipo de entrada no permitido para administración.");
    }
  } else {
    if (profile.companyWorkerId !== companyWorkerId) {
      throw new Error("No puedes crear entradas en la agenda de otro trabajador.");
    }
    if (!workerTypeSet.has(itemType)) {
      throw new Error("Tipo de entrada no permitido.");
    }
  }

  const { data, error } = await sb
    .from("worker_agenda_items")
    .insert({
      company_worker_id: companyWorkerId,
      applies_to_all_company_workers: false,
      project_id: null,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      starts_at: input.startsAt,
      ends_at: input.endsAt ?? null,
      item_type: itemType,
      source,
      created_by_backoffice_user_id: profile.id,
    })
    .select("*")
    .single();

  if (error) throwErr(error);
  return rowToDomain(data as WorkerAgendaItemRow);
}

export type UpdateWorkerAgendaItemInput = {
  title?: string;
  description?: string | null;
  startsAt?: string;
  endsAt?: string | null;
  itemType?: WorkerAgendaItemType;
};

export async function updateWorkerAgendaItem(
  id: string,
  patch: UpdateWorkerAgendaItemInput
): Promise<WorkerAgendaItemRecord> {
  const sb = requireSupabase();
  const profile = await requireProfile();

  const { data: existing, error: fetchErr } = await sb.from("worker_agenda_items").select("*").eq("id", id).single();
  if (fetchErr) throwErr(fetchErr);
  const row = existing as WorkerAgendaItemRow;
  const domain = rowToDomain(row);

  if (profile.role === "WORKER") {
    if (domain.appliesToAllCompanyWorkers || domain.projectId != null || domain.companyWorkerId == null) {
      throw new Error("No puedes editar esta entrada.");
    }
    if (profile.companyWorkerId !== domain.companyWorkerId) {
      throw new Error("No puedes editar esta entrada.");
    }
    if (domain.source === "ADMIN") {
      throw new Error("No puedes editar entradas del administrador.");
    }
  }

  if ((domain.appliesToAllCompanyWorkers || domain.projectId != null) && patch.itemType === "todo") {
    throw new Error("Este tipo de entrada no admite to-dos.");
  }

  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title.trim();
  if (patch.description !== undefined) update.description = patch.description?.trim() || null;
  if (patch.startsAt !== undefined) update.starts_at = patch.startsAt;
  if (patch.endsAt !== undefined) update.ends_at = patch.endsAt;
  if (patch.itemType !== undefined) {
    if (profile.role === "WORKER") {
      if (!workerTypeSet.has(patch.itemType)) {
        throw new Error("Tipo no permitido.");
      }
    }
    update.item_type = patch.itemType;
  }

  const { data, error } = await sb.from("worker_agenda_items").update(update).eq("id", id).select("*").single();
  if (error) throwErr(error);
  return rowToDomain(data as WorkerAgendaItemRow);
}

/**
 * El trabajador marca como hecho un to-do creado por administración.
 * Notifica por mensaje interno al admin que lo creó (`created_by_backoffice_user_id`).
 */
export async function completeWorkerAgendaTodo(id: string): Promise<WorkerAgendaItemRecord> {
  const profile = await requireProfile();
  if (profile.role !== "WORKER") {
    throw new Error("Solo el trabajador puede marcar esta tarea como realizada.");
  }
  const sb = requireSupabase();
  const { data: existing, error: fetchErr } = await sb.from("worker_agenda_items").select("*").eq("id", id).single();
  if (fetchErr) throwErr(fetchErr);
  const domain = rowToDomain(existing as WorkerAgendaItemRow);

  if (domain.appliesToAllCompanyWorkers || domain.projectId != null || domain.companyWorkerId == null) {
    throw new Error("No puedes modificar esta entrada.");
  }
  if (profile.companyWorkerId !== domain.companyWorkerId) {
    throw new Error("No puedes modificar esta entrada.");
  }
  if (domain.itemType !== "todo" || domain.source !== "ADMIN") {
    throw new Error("Solo se pueden completar tareas (to-do) añadidas por administración.");
  }
  if (domain.completedAt) {
    throw new Error("Esta tarea ya está marcada como realizada.");
  }

  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("worker_agenda_items")
    .update({
      completed_at: now,
      completed_by_backoffice_user_id: profile.id,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throwErr(error);
  const updated = rowToDomain(data as WorkerAgendaItemRow);

  const creatorId = domain.createdByBackofficeUserId;
  if (creatorId && creatorId !== profile.id) {
    const w = await getCompanyWorkerById(domain.companyWorkerId);
    const workerLabel = w ? `${w.firstName} ${w.lastName}`.trim() : "Trabajador";
    await createBackofficeMessage(creatorId, {
      category: "AGENDA_TODO_COMPLETED",
      title: `To-do completado: ${domain.title}`,
      body: `${workerLabel} ha marcado como realizado el to-do «${domain.title}».`,
      payload: { agendaItemId: id, companyWorkerId: domain.companyWorkerId },
      threadTitle: `To-do completado: ${domain.title}`,
    });
  }

  return updated;
}

export async function deleteWorkerAgendaItem(id: string): Promise<void> {
  const sb = requireSupabase();
  const profile = await requireProfile();

  const { data: existing, error: fetchErr } = await sb.from("worker_agenda_items").select("*").eq("id", id).single();
  if (fetchErr) throwErr(fetchErr);
  const domain = rowToDomain(existing as WorkerAgendaItemRow);

  if (profile.role === "WORKER") {
    if (domain.appliesToAllCompanyWorkers || domain.projectId != null || domain.companyWorkerId == null) {
      throw new Error("No puedes eliminar esta entrada.");
    }
    if (profile.companyWorkerId !== domain.companyWorkerId) {
      throw new Error("No puedes eliminar esta entrada.");
    }
    if (domain.source === "ADMIN") {
      throw new Error("No puedes eliminar entradas del administrador.");
    }
  }

  const { error } = await sb.from("worker_agenda_items").delete().eq("id", id);
  if (error) throwErr(error);
}
