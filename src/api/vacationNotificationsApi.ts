import { fetchCompanyWorkers } from "@/api/companyWorkersApi";
import { fetchWorkCalendarSites } from "@/api/workCalendarSitesApi";
import { requireSupabase } from "@/api/supabaseRequire";
import { getErrorMessage } from "@/lib/errorMessage";
import { isoDateOnlyFromDb } from "@/lib/isoDate";
import { companyWorkerDisplayName } from "@/types/companyWorkers";
import type { CompanyWorkerVacationDayNotificationRow } from "@/types/database";

function throwSupabaseError(err: unknown): never {
  throw new Error(getErrorMessage(err));
}

export type WorkerVacationDayNotificationRecord = {
  id: string;
  companyWorkerId: string;
  calendarYear: number;
  vacationDateAdded: string;
  createdAt: string;
  /** Relleno en listados admin */
  workerName?: string;
  siteName?: string;
};

function rowToDomain(r: CompanyWorkerVacationDayNotificationRow): WorkerVacationDayNotificationRecord {
  return {
    id: r.id,
    companyWorkerId: r.company_worker_id,
    calendarYear: r.calendar_year,
    vacationDateAdded: isoDateOnlyFromDb(r.vacation_date_added),
    createdAt: r.created_at,
  };
}

/**
 * Registra aviso para administración (no bloquea si falla el insert).
 */
export async function recordVacationDayAddedNotification(
  companyWorkerId: string,
  calendarYear: number,
  vacationDateIso: string
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("worker_vacation_day_notifications").insert({
    company_worker_id: companyWorkerId,
    calendar_year: calendarYear,
    vacation_date_added: vacationDateIso,
  });
  if (error) throwSupabaseError(error);
}

/** Últimas notificaciones para el panel admin (más recientes primero). */
export async function fetchAdminVacationDayNotifications(
  limit = 100
): Promise<WorkerVacationDayNotificationRecord[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("worker_vacation_day_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(500, Math.max(1, limit)));
  if (error) throwSupabaseError(error);
  return (data ?? []).map((r) => rowToDomain(r as CompanyWorkerVacationDayNotificationRow));
}

/** Listado enriquecido con nombre y centro (para tablas admin). */
export async function fetchAdminVacationDayNotificationsEnriched(
  limit = 100
): Promise<WorkerVacationDayNotificationRecord[]> {
  const [rows, workers, sites] = await Promise.all([
    fetchAdminVacationDayNotifications(limit),
    fetchCompanyWorkers(),
    fetchWorkCalendarSites(),
  ]);
  const siteMap = new Map(sites.map((s) => [s.id, s.name] as const));
  const workerMap = new Map(workers.map((w) => [w.id, w] as const));
  return rows.map((n) => {
    const w = workerMap.get(n.companyWorkerId);
    return {
      ...n,
      workerName: w ? companyWorkerDisplayName(w) : "—",
      siteName: w ? siteMap.get(w.workCalendarSiteId) ?? "—" : "—",
    };
  });
}

/** Para badge del menú: notificaciones en los últimos N días. */
export async function countVacationNotificationsSinceDays(days: number): Promise<number> {
  const sb = requireSupabase();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { count, error } = await sb
    .from("worker_vacation_day_notifications")
    .select("*", { count: "exact", head: true })
    .gte("created_at", since.toISOString());
  if (error) throwSupabaseError(error);
  return count ?? 0;
}
