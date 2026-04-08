import { getProfileByAuthUserId } from "@/api/backofficeUsersApi";
import { requireSupabase } from "@/api/supabaseRequire";
import { getErrorMessage } from "@/lib/errorMessage";
import type { WorkerAgendaItemRow } from "@/types/database";
import type {
  WorkerAgendaItemRecord,
  WorkerAgendaItemSource,
  WorkerAgendaItemType,
} from "@/types/agenda";

function throwErr(e: unknown): never {
  throw new Error(getErrorMessage(e));
}

function rowToDomain(row: WorkerAgendaItemRow): WorkerAgendaItemRecord {
  return {
    id: row.id,
    companyWorkerId: row.company_worker_id,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    itemType: row.item_type as WorkerAgendaItemType,
    source: row.source as WorkerAgendaItemSource,
    createdByBackofficeUserId: row.created_by_backoffice_user_id,
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

  const { data, error } = await sb
    .from("worker_agenda_items")
    .select("*")
    .eq("company_worker_id", companyWorkerId)
    .gte("starts_at", start)
    .lte("starts_at", end)
    .order("starts_at", { ascending: true });

  if (error) throwErr(error);
  return (data ?? []).map((r) => rowToDomain(r as WorkerAgendaItemRow));
}

export type CreateWorkerAgendaItemInput = {
  companyWorkerId: string;
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
  let itemType = input.itemType;
  if (profile.role === "ADMIN") {
    source = "ADMIN";
    itemType = "admin_note";
  } else {
    if (profile.companyWorkerId !== input.companyWorkerId) {
      throw new Error("No puedes crear entradas en la agenda de otro trabajador.");
    }
    if (itemType === "admin_note") {
      throw new Error("Tipo no permitido.");
    }
  }

  const { data, error } = await sb
    .from("worker_agenda_items")
    .insert({
      company_worker_id: input.companyWorkerId,
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
    if (profile.companyWorkerId !== domain.companyWorkerId) {
      throw new Error("No puedes editar esta entrada.");
    }
    if (domain.source === "ADMIN") {
      throw new Error("No puedes editar notas de administración.");
    }
  }

  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title.trim();
  if (patch.description !== undefined) update.description = patch.description?.trim() || null;
  if (patch.startsAt !== undefined) update.starts_at = patch.startsAt;
  if (patch.endsAt !== undefined) update.ends_at = patch.endsAt;
  if (patch.itemType !== undefined) {
    if (profile.role === "WORKER" && patch.itemType === "admin_note") {
      throw new Error("Tipo no permitido.");
    }
    update.item_type = patch.itemType;
  }

  const { data, error } = await sb.from("worker_agenda_items").update(update).eq("id", id).select("*").single();
  if (error) throwErr(error);
  return rowToDomain(data as WorkerAgendaItemRow);
}

export async function deleteWorkerAgendaItem(id: string): Promise<void> {
  const sb = requireSupabase();
  const profile = await requireProfile();

  const { data: existing, error: fetchErr } = await sb.from("worker_agenda_items").select("*").eq("id", id).single();
  if (fetchErr) throwErr(fetchErr);
  const domain = rowToDomain(existing as WorkerAgendaItemRow);

  if (profile.role === "WORKER") {
    if (profile.companyWorkerId !== domain.companyWorkerId) {
      throw new Error("No puedes eliminar esta entrada.");
    }
    if (domain.source === "ADMIN") {
      throw new Error("No puedes eliminar notas de administración.");
    }
  }

  const { error } = await sb.from("worker_agenda_items").delete().eq("id", id);
  if (error) throwErr(error);
}
