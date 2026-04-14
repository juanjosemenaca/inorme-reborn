import { createBackofficeMessage } from "@/api/backofficeMessagesApi";
import { fetchBackofficeUsers, getProfileByAuthUserId } from "@/api/backofficeUsersApi";
import { requireSupabase } from "@/api/supabaseRequire";
import { fetchClientPublicIp } from "@/lib/clientPublicIp";
import { getErrorMessage } from "@/lib/errorMessage";
import type { WorkerTimeClockEventRow } from "@/types/database";
import type { TimeClockDailySummary, TimeClockEventKind, TimeClockEventRecord } from "@/types/timeTracking";

function throwErr(error: unknown): never {
  throw new Error(getErrorMessage(error));
}

/** Columnas expuestas al trabajador (sin IP de entrada). */
const WORKER_TIME_CLOCK_COLUMNS =
  "id, company_worker_id, event_kind, event_at, absence_reason, comment, source, created_by_backoffice_user_id, created_at, updated_at";

function rowToDomain(row: WorkerTimeClockEventRow, includeClockInIp: boolean): TimeClockEventRecord {
  return {
    id: row.id,
    companyWorkerId: row.company_worker_id,
    eventKind: row.event_kind,
    eventAt: row.event_at,
    absenceReason: row.absence_reason,
    comment: row.comment ?? "",
    source: row.source,
    createdByBackofficeUserId: row.created_by_backoffice_user_id,
    clockInClientIp:
      includeClockInIp && row.event_kind === "CLOCK_IN" ? (row.clock_in_client_ip ?? null) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type CurrentProfile = {
  backofficeUserId: string;
  role: "ADMIN" | "WORKER";
  companyWorkerId: string | null;
};

async function requireCurrentProfile(): Promise<CurrentProfile> {
  const sb = requireSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sesion no valida.");
  const profile = await getProfileByAuthUserId(user.id);
  if (!profile) throw new Error("No se pudo resolver el perfil backoffice.");
  return {
    backofficeUserId: profile.id,
    role: profile.role,
    companyWorkerId: profile.companyWorkerId,
  };
}

function toIsoStart(isoDate: string): string {
  return `${isoDate}T00:00:00.000Z`;
}

function toIsoEnd(isoDate: string): string {
  return `${isoDate}T23:59:59.999Z`;
}

async function countMyEventsForDayAndKinds(
  companyWorkerId: string,
  isoDate: string,
  kinds: TimeClockEventKind[]
): Promise<number> {
  const sb = requireSupabase();
  const { count, error } = await sb
    .from("worker_time_clock_events")
    .select("id", { count: "exact", head: true })
    .eq("company_worker_id", companyWorkerId)
    .in("event_kind", kinds)
    .gte("event_at", toIsoStart(isoDate))
    .lte("event_at", toIsoEnd(isoDate));
  if (error) throwErr(error);
  return count ?? 0;
}

async function resolveOpenBreakCommentAtMoment(
  companyWorkerId: string,
  eventAtIso: string
): Promise<string | null> {
  const sb = requireSupabase();
  const dayIso = eventAtIso.slice(0, 10);
  const { data, error } = await sb
    .from("worker_time_clock_events")
    .select("*")
    .eq("company_worker_id", companyWorkerId)
    .gte("event_at", toIsoStart(dayIso))
    .lte("event_at", eventAtIso)
    .order("event_at", { ascending: true });
  if (error) throwErr(error);
  let openBreakComment: string | null = null;
  for (const row of (data ?? []) as WorkerTimeClockEventRow[]) {
    if (row.event_kind === "BREAK_START") {
      openBreakComment = (row.comment ?? "").trim() || null;
    } else if (row.event_kind === "BREAK_END" || row.event_kind === "CLOCK_OUT" || row.event_kind === "ABSENCE") {
      openBreakComment = null;
    }
  }
  return openBreakComment;
}

export async function fetchMyTimeClockEvents(fromIsoDate: string, toIsoDate: string): Promise<TimeClockEventRecord[]> {
  const sb = requireSupabase();
  const profile = await requireCurrentProfile();
  if (!profile.companyWorkerId) return [];
  const { data, error } = await sb
    .from("worker_time_clock_events")
    .select(WORKER_TIME_CLOCK_COLUMNS)
    .eq("company_worker_id", profile.companyWorkerId)
    .gte("event_at", toIsoStart(fromIsoDate))
    .lte("event_at", toIsoEnd(toIsoDate))
    .order("event_at", { ascending: true });
  if (error) throwErr(error);
  return (data ?? []).map((r) => rowToDomain(r as WorkerTimeClockEventRow, false));
}

export async function fetchWorkerTimeClockEvents(
  workerId: string,
  fromIsoDate: string,
  toIsoDate: string
): Promise<TimeClockEventRecord[]> {
  const sb = requireSupabase();
  const profile = await requireCurrentProfile();
  if (profile.role !== "ADMIN") throw new Error("Solo administracion puede consultar fichajes de terceros.");
  const { data, error } = await sb
    .from("worker_time_clock_events")
    .select("*")
    .eq("company_worker_id", workerId)
    .gte("event_at", toIsoStart(fromIsoDate))
    .lte("event_at", toIsoEnd(toIsoDate))
    .order("event_at", { ascending: true });
  if (error) throwErr(error);
  return (data ?? []).map((r) => rowToDomain(r as WorkerTimeClockEventRow, true));
}

export async function fetchWorkersTimeClockEventsAsAdmin(
  workerIds: string[],
  fromIsoDate: string,
  toIsoDate: string
): Promise<TimeClockEventRecord[]> {
  if (workerIds.length === 0) return [];
  const sb = requireSupabase();
  const profile = await requireCurrentProfile();
  if (profile.role !== "ADMIN") throw new Error("Solo administracion puede consultar fichajes de terceros.");
  const { data, error } = await sb
    .from("worker_time_clock_events")
    .select("*")
    .in("company_worker_id", workerIds)
    .gte("event_at", toIsoStart(fromIsoDate))
    .lte("event_at", toIsoEnd(toIsoDate))
    .order("company_worker_id", { ascending: true })
    .order("event_at", { ascending: true });
  if (error) throwErr(error);
  return (data ?? []).map((r) => rowToDomain(r as WorkerTimeClockEventRow, true));
}

export type CreateTimeClockEventInput = {
  eventKind: TimeClockEventKind;
  eventAt?: string;
  absenceReason?: string | null;
  comment?: string;
};

export async function createMyTimeClockEvent(input: CreateTimeClockEventInput): Promise<void> {
  const sb = requireSupabase();
  const profile = await requireCurrentProfile();
  if (!profile.companyWorkerId) throw new Error("Tu cuenta no tiene una ficha de trabajador vinculada.");
  const eventAt = input.eventAt ?? new Date().toISOString();
  const targetIso = eventAt.slice(0, 10);
  if (input.eventKind === "CLOCK_IN") {
    const count = await countMyEventsForDayAndKinds(profile.companyWorkerId, targetIso, ["CLOCK_IN"]);
    if (count > 0) throw new Error("Ya existe una entrada registrada para ese día.");
  }
  if (input.eventKind === "CLOCK_OUT") {
    const count = await countMyEventsForDayAndKinds(profile.companyWorkerId, targetIso, ["CLOCK_OUT"]);
    if (count > 0) throw new Error("Ya existe una salida final registrada para ese día.");
  }
  const normalizedComment = input.comment?.trim() ?? "";
  if (input.eventKind === "BREAK_START" && !normalizedComment) {
    throw new Error("Debes escribir un comentario antes de iniciar la pausa.");
  }
  if (input.eventKind === "ABSENCE" && !(input.absenceReason?.trim() ?? "")) {
    throw new Error("Debes indicar un motivo de ausencia.");
  }
  let effectiveComment = normalizedComment;
  if (input.eventKind === "BREAK_END") {
    const inherited = await resolveOpenBreakCommentAtMoment(profile.companyWorkerId, eventAt);
    if (!inherited) {
      throw new Error("No hay una pausa iniciada con comentario para poder finalizarla.");
    }
    effectiveComment = inherited;
  }
  let clockInClientIp: string | null = null;
  if (input.eventKind === "CLOCK_IN") {
    clockInClientIp = await fetchClientPublicIp();
  }

  const { error } = await sb.from("worker_time_clock_events").insert({
    company_worker_id: profile.companyWorkerId,
    event_kind: input.eventKind,
    event_at: eventAt,
    absence_reason: input.eventKind === "ABSENCE" ? input.absenceReason?.trim() || null : null,
    comment: effectiveComment,
    source: "WORKER",
    created_by_backoffice_user_id: profile.backofficeUserId,
    clock_in_client_ip: input.eventKind === "CLOCK_IN" ? clockInClientIp : null,
  });
  if (error) throwErr(error);
}

export async function createAdminTimeClockEvent(
  workerId: string,
  input: CreateTimeClockEventInput
): Promise<void> {
  const sb = requireSupabase();
  const profile = await requireCurrentProfile();
  if (profile.role !== "ADMIN") throw new Error("Solo administracion puede crear fichajes de terceros.");
  let clockInClientIp: string | null = null;
  if (input.eventKind === "CLOCK_IN") {
    clockInClientIp = await fetchClientPublicIp();
  }
  const { error } = await sb.from("worker_time_clock_events").insert({
    company_worker_id: workerId,
    event_kind: input.eventKind,
    event_at: input.eventAt ?? new Date().toISOString(),
    absence_reason: input.eventKind === "ABSENCE" ? input.absenceReason?.trim() || null : null,
    comment: input.comment?.trim() ?? "",
    source: "ADMIN",
    created_by_backoffice_user_id: profile.backofficeUserId,
    clock_in_client_ip: input.eventKind === "CLOCK_IN" ? clockInClientIp : null,
  });
  if (error) throwErr(error);
}

export async function updateTimeClockEventAsAdmin(
  eventId: string,
  patch: Partial<CreateTimeClockEventInput>
): Promise<void> {
  const sb = requireSupabase();
  const profile = await requireCurrentProfile();
  if (profile.role !== "ADMIN") throw new Error("Solo administracion puede modificar fichajes.");
  const update: Record<string, string | null> = {};
  if (patch.eventKind !== undefined) update.event_kind = patch.eventKind;
  if (patch.eventAt !== undefined) update.event_at = patch.eventAt;
  if (patch.comment !== undefined) update.comment = patch.comment.trim();
  if (patch.absenceReason !== undefined) update.absence_reason = patch.absenceReason?.trim() || null;
  if (Object.keys(update).length === 0) return;
  const { error } = await sb.from("worker_time_clock_events").update(update).eq("id", eventId);
  if (error) throwErr(error);
}

export async function deleteTimeClockEventAsAdmin(eventId: string): Promise<void> {
  const sb = requireSupabase();
  const profile = await requireCurrentProfile();
  if (profile.role !== "ADMIN") throw new Error("Solo administracion puede eliminar fichajes.");
  const { error } = await sb.from("worker_time_clock_events").delete().eq("id", eventId);
  if (error) throwErr(error);
}

export async function deleteTimeClockDayAsAdmin(workerId: string, isoDate: string): Promise<void> {
  const sb = requireSupabase();
  const profile = await requireCurrentProfile();
  if (profile.role !== "ADMIN") throw new Error("Solo administracion puede eliminar fichajes.");
  const { error } = await sb
    .from("worker_time_clock_events")
    .delete()
    .eq("company_worker_id", workerId)
    .gte("event_at", toIsoStart(isoDate))
    .lte("event_at", toIsoEnd(isoDate));
  if (error) throwErr(error);
}

export async function requestTimeClockCorrection(input: {
  message: string;
  relatedDate?: string;
}): Promise<void> {
  const profile = await requireCurrentProfile();
  if (!profile.companyWorkerId) throw new Error("Tu cuenta no tiene ficha vinculada.");
  const admins = (await fetchBackofficeUsers()).filter((u) => u.role === "ADMIN" && u.active);
  const text = input.message.trim();
  if (!text) throw new Error("Escribe un mensaje.");
  await Promise.all(
    admins.map((a) =>
      createBackofficeMessage(a.id, {
        category: "TIME_CLOCK_CORRECTION",
        title: "Solicitud de correccion de fichaje",
        body: `${text}${input.relatedDate ? `\nFecha: ${input.relatedDate}` : ""}`,
        payload: {
          kind: "time_clock_correction",
          workerId: profile.companyWorkerId,
          relatedDate: input.relatedDate ?? null,
        },
      })
    )
  );
}

function dayIso(isoDateTime: string): string {
  return isoDateTime.slice(0, 10);
}

export function computeDailyTimeSummaries(events: TimeClockEventRecord[]): TimeClockDailySummary[] {
  const byDay = new Map<string, TimeClockEventRecord[]>();
  for (const e of events) {
    const d = dayIso(e.eventAt);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(e);
  }

  return [...byDay.entries()]
    .map(([day, rows]) => {
      const sorted = [...rows].sort((a, b) => a.eventAt.localeCompare(b.eventAt));
      let workedMs = 0;
      let openStart: string | null = null;
      let absenceReason: string | null = null;
      for (const r of sorted) {
        if (r.eventKind === "ABSENCE") {
          absenceReason = r.absenceReason ?? "Ausencia";
          openStart = null;
          continue;
        }
        if (r.eventKind === "CLOCK_IN" || r.eventKind === "BREAK_END") {
          openStart = r.eventAt;
          continue;
        }
        if ((r.eventKind === "BREAK_START" || r.eventKind === "CLOCK_OUT") && openStart) {
          const startMs = new Date(openStart).getTime();
          const endMs = new Date(r.eventAt).getTime();
          if (endMs > startMs) workedMs += endMs - startMs;
          openStart = null;
        }
      }
      return {
        dayIso: day,
        workedMinutes: Math.max(0, Math.floor(workedMs / 60000)),
        hasAbsence: !!absenceReason,
        absenceReason,
      };
    })
    .sort((a, b) => a.dayIso.localeCompare(b.dayIso));
}
