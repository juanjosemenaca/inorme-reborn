import { requireSupabase } from "@/api/supabaseRequire";
import { getProfileByAuthUserId } from "@/api/backofficeUsersApi";
import { getCompanyWorkerById } from "@/api/companyWorkersApi";
import { fetchWorkCalendarHolidays } from "@/api/workCalendarsApi";
import { getErrorMessage } from "@/lib/errorMessage";
import { isWeekendIso } from "@/lib/calendarIso";
import { recordVacationDayAddedNotification } from "@/api/vacationNotificationsApi";
import { isoDateOnlyFromDb, parseIsoDateYmdCalendar } from "@/lib/isoDate";

function throwSupabaseError(err: unknown): never {
  throw new Error(getErrorMessage(err));
}

async function requireWorkerProfile(): Promise<{ workerId: string }> {
  const sb = requireSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sesión no válida.");
  const profile = await getProfileByAuthUserId(user.id);
  if (!profile?.companyWorkerId) throw new Error("Tu usuario no está vinculado a un trabajador.");
  return { workerId: profile.companyWorkerId };
}

/**
 * Fechas ISO (YYYY-MM-DD) de vacaciones del usuario autenticado en el año natural.
 */
export async function fetchMyVacationDatesForYear(year: number): Promise<string[]> {
  const { workerId } = await requireWorkerProfile();
  const sb = requireSupabase();
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const { data, error } = await sb
    .from("company_worker_vacation_days")
    .select("vacation_date")
    .eq("company_worker_id", workerId)
    .gte("vacation_date", start)
    .lte("vacation_date", end)
    .order("vacation_date", { ascending: true });
  if (error) throwSupabaseError(error);
  return (data ?? []).map((r) => isoDateOnlyFromDb(String((r as { vacation_date: string }).vacation_date)));
}

export type ToggleVacationDayResult = {
  action: "added" | "removed";
  /** Solo si action === "added" y el registro de aviso para admin se insertó bien. */
  adminNotified?: boolean;
};

/**
 * Alterna un día: si ya estaba reservado, lo quita; si no, lo añade (día laborable y bajo cupo).
 */
export async function toggleMyVacationDay(
  calendarYear: number,
  isoDate: string
): Promise<ToggleVacationDayResult> {
  const { iso, year } = parseIsoDateYmdCalendar(isoDate);
  if (year !== calendarYear) {
    throw new Error("La fecha no pertenece al año seleccionado.");
  }

  const sb = requireSupabase();
  const { workerId } = await requireWorkerProfile();

  const { data: existing, error: selErr } = await sb
    .from("company_worker_vacation_days")
    .select("id")
    .eq("company_worker_id", workerId)
    .eq("vacation_date", iso)
    .maybeSingle();
  if (selErr) throwSupabaseError(selErr);

  if (existing) {
    const { error } = await sb.from("company_worker_vacation_days").delete().eq("id", existing.id);
    if (error) throwSupabaseError(error);
    return { action: "removed" };
  }

  const worker = await getCompanyWorkerById(workerId);
  if (!worker) throw new Error("Trabajador no encontrado.");

  const holidays = await fetchWorkCalendarHolidays(calendarYear);
  const holidaySet = new Set(
    holidays
      .filter((h) => h.siteId === worker.workCalendarSiteId)
      .map((h) => isoDateOnlyFromDb(h.holidayDate))
  );

  if (isWeekendIso(iso)) {
    throw new Error("No puedes reservar vacaciones en fin de semana.");
  }
  if (holidaySet.has(iso)) {
    throw new Error("No puedes reservar vacaciones en un festivo.");
  }

  const { data: rows, error: countErr } = await sb
    .from("company_worker_vacation_days")
    .select("id")
    .eq("company_worker_id", workerId)
    .gte("vacation_date", `${calendarYear}-01-01`)
    .lte("vacation_date", `${calendarYear}-12-31`);
  if (countErr) throwSupabaseError(countErr);
  const count = (rows ?? []).length;
  if (count >= worker.vacationDays) {
    throw new Error(
      `Has alcanzado el máximo de ${worker.vacationDays} días de vacaciones para este año.`
    );
  }

  const { error: insErr } = await sb.from("company_worker_vacation_days").insert({
    company_worker_id: workerId,
    vacation_date: iso,
  });
  if (insErr) throwSupabaseError(insErr);

  let adminNotified = false;
  try {
    await recordVacationDayAddedNotification(workerId, calendarYear, iso);
    adminNotified = true;
  } catch (e) {
    console.error("[vacation] No se pudo registrar el aviso para administración:", e);
  }
  return { action: "added", adminNotified };
}
