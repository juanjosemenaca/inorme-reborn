import { requireSupabase } from "@/api/supabaseRequire";
import { getErrorMessage } from "@/lib/errorMessage";
import { workCalendarSiteRowToDomain } from "@/lib/supabase/mappers";
import type { WorkCalendarHolidayRow, WorkCalendarSiteRow, WorkCalendarSummerRangeRow } from "@/types/database";
import type { WorkCalendarSiteRecord } from "@/types/workCalendars";

function throwErr(e: unknown): never {
  throw new Error(getErrorMessage(e));
}

export async function fetchWorkCalendarSites(): Promise<WorkCalendarSiteRecord[]> {
  const sb = requireSupabase();
  const { data: rows, error } = await sb
    .from("work_calendar_sites")
    .select("*")
    .order("is_system", { ascending: false })
    .order("name", { ascending: true });
  if (error) throwErr(error);
  return (rows ?? []).map((r) => workCalendarSiteRowToDomain(r as WorkCalendarSiteRow));
}

export async function getWorkCalendarSiteById(id: string): Promise<WorkCalendarSiteRecord | undefined> {
  const sb = requireSupabase();
  const { data: row, error } = await sb.from("work_calendar_sites").select("*").eq("id", id).maybeSingle();
  if (error) throwErr(error);
  return row ? workCalendarSiteRowToDomain(row as WorkCalendarSiteRow) : undefined;
}

/** Slug estable: mayúsculas, sin acentos, solo [A-Z0-9_]. */
function baseSlugFromName(name: string): string {
  const t = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return (t || "SEDE").slice(0, 48);
}

async function ensureUniqueSlug(sb: ReturnType<typeof requireSupabase>, base: string): Promise<string> {
  let candidate = base;
  let n = 0;
  while (true) {
    const { data, error } = await sb.from("work_calendar_sites").select("id").eq("slug", candidate).maybeSingle();
    if (error) throwErr(error);
    if (!data) return candidate;
    n += 1;
    candidate = `${base}_${n}`.slice(0, 48);
  }
}

/**
 * Nueva sede: copia todos los festivos y rangos de horario de verano de Barcelona (todas las filas en BD).
 */
export async function createWorkCalendarSiteFromBarcelona(input: {
  name: string;
  vacationDaysDefault: number;
}): Promise<WorkCalendarSiteRecord> {
  const sb = requireSupabase();
  const name = input.name.trim();
  if (!name) throw new Error("Indica el nombre de la sede.");

  const { data: barcelona, error: bErr } = await sb
    .from("work_calendar_sites")
    .select("id")
    .eq("slug", "BARCELONA")
    .maybeSingle();
  if (bErr) throwErr(bErr);
  if (!barcelona) throw new Error("No se encontró la sede plantilla Barcelona.");

  const slug = await ensureUniqueSlug(sb, baseSlugFromName(name));
  const vd = Math.min(365, Math.max(0, Math.floor(input.vacationDaysDefault)));

  const { data: inserted, error: insErr } = await sb
    .from("work_calendar_sites")
    .insert({
      slug,
      name,
      vacation_days_default: vd,
      is_system: false,
    })
    .select("*")
    .single();
  if (insErr) throwErr(insErr);
  const site = workCalendarSiteRowToDomain(inserted as WorkCalendarSiteRow);
  const barcelonaId = (barcelona as { id: string }).id;

  const { data: holRows, error: hErr } = await sb
    .from("work_calendar_holidays")
    .select("*")
    .eq("site_id", barcelonaId);
  if (hErr) throwErr(hErr);
  if (holRows && holRows.length > 0) {
    const payload = holRows.map((r) => ({
      calendar_year: (r as WorkCalendarHolidayRow).calendar_year,
      site_id: site.id,
      holiday_date: (r as WorkCalendarHolidayRow).holiday_date,
      holiday_kind: (r as WorkCalendarHolidayRow).holiday_kind,
      label: (r as WorkCalendarHolidayRow).label,
    }));
    const { error: hiErr } = await sb.from("work_calendar_holidays").insert(payload);
    if (hiErr) throwErr(hiErr);
  }

  const { data: sumRows, error: sErr } = await sb
    .from("work_calendar_summer_days")
    .select("*")
    .eq("site_id", barcelonaId);
  if (sErr) throwErr(sErr);
  if (sumRows && sumRows.length > 0) {
    const payload = sumRows.map((r) => ({
      calendar_year: (r as WorkCalendarSummerRangeRow).calendar_year,
      site_id: site.id,
      date_start: (r as WorkCalendarSummerRangeRow).date_start,
      date_end: (r as WorkCalendarSummerRangeRow).date_end,
      label: (r as WorkCalendarSummerRangeRow).label,
    }));
    const { error: siErr } = await sb.from("work_calendar_summer_days").insert(payload);
    if (siErr) throwErr(siErr);
  }

  return site;
}

export async function updateWorkCalendarSite(
  id: string,
  patch: Partial<Pick<WorkCalendarSiteRecord, "name" | "vacationDaysDefault">>
): Promise<WorkCalendarSiteRecord> {
  const sb = requireSupabase();
  const before = await getWorkCalendarSiteById(id);
  if (!before) throw new Error("Sede no encontrada.");

  const update: Record<string, string | number | boolean> = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.vacationDaysDefault !== undefined) {
    update.vacation_days_default = Math.min(365, Math.max(0, Math.floor(patch.vacationDaysDefault)));
  }
  if (Object.keys(update).length === 0) {
    return before;
  }
  const { data: row, error } = await sb
    .from("work_calendar_sites")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throwErr(error);

  return workCalendarSiteRowToDomain(row as WorkCalendarSiteRow);
}

export async function deleteWorkCalendarSite(id: string): Promise<void> {
  const sb = requireSupabase();
  const { data: site, error: fErr } = await sb.from("work_calendar_sites").select("is_system").eq("id", id).single();
  if (fErr) throwErr(fErr);
  if ((site as { is_system: boolean }).is_system) {
    throw new Error("No se pueden eliminar las sedes predefinidas del sistema.");
  }
  const { count, error: cErr } = await sb
    .from("company_workers")
    .select("id", { count: "exact", head: true })
    .eq("work_calendar_site_id", id);
  if (cErr) throwErr(cErr);
  if ((count ?? 0) > 0) {
    throw new Error("Hay trabajadores asignados a esta sede. Reasígnalos antes de eliminarla.");
  }
  const { error } = await sb.from("work_calendar_sites").delete().eq("id", id);
  if (error) throwErr(error);
}
