import { requireSupabase } from "@/api/supabaseRequire";
import { getErrorMessage } from "@/lib/errorMessage";
import { parseIsoDateYmdCalendar } from "@/lib/isoDate";
import { workCalendarHolidayRowToDomain, workCalendarSummerRangeRowToDomain } from "@/lib/supabase/mappers";
import type { WorkCalendarHolidayRow, WorkCalendarSummerRangeRow } from "@/types/database";
import type {
  WorkCalendarHolidayKind,
  WorkCalendarHolidayRecord,
  WorkCalendarSummerRangeRecord,
} from "@/types/workCalendars";

function throwSupabaseError(err: unknown): never {
  throw new Error(getErrorMessage(err));
}

export async function fetchWorkCalendarHolidays(year: number): Promise<WorkCalendarHolidayRecord[]> {
  const sb = requireSupabase();
  const { data: rows, error } = await sb
    .from("work_calendar_holidays")
    .select("*")
    .eq("calendar_year", year)
    .order("holiday_date", { ascending: true });
  if (error) throwSupabaseError(error);
  return (rows ?? []).map((r) => workCalendarHolidayRowToDomain(r as WorkCalendarHolidayRow));
}

export async function createWorkCalendarHoliday(
  holiday: Omit<WorkCalendarHolidayRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }
): Promise<WorkCalendarHolidayRecord> {
  const sb = requireSupabase();
  const { iso: holidayDateIso, year: yFromDate } = parseIsoDateYmdCalendar(holiday.holidayDate);
  if (yFromDate !== holiday.calendarYear) {
    throw new Error("La fecha debe pertenecer al año seleccionado.");
  }
  const { data: row, error } = await sb
    .from("work_calendar_holidays")
    .insert({
      calendar_year: holiday.calendarYear,
      site_id: holiday.siteId,
      holiday_date: holidayDateIso,
      holiday_kind: holiday.holidayKind,
      label: holiday.label.trim(),
    })
    .select("*")
    .single();
  if (error) throwSupabaseError(error);
  return workCalendarHolidayRowToDomain(row as WorkCalendarHolidayRow);
}

export async function updateWorkCalendarHoliday(
  id: string,
  patch: Partial<Pick<WorkCalendarHolidayRecord, "holidayDate" | "label" | "holidayKind">>
): Promise<WorkCalendarHolidayRecord> {
  const sb = requireSupabase();
  const update: Record<string, string | number> = {};
  if (patch.holidayDate !== undefined) {
    const { iso, year } = parseIsoDateYmdCalendar(patch.holidayDate);
    update.holiday_date = iso;
    update.calendar_year = year;
  }
  if (patch.label !== undefined) update.label = patch.label.trim();
  if (patch.holidayKind !== undefined) update.holiday_kind = patch.holidayKind;
  if (Object.keys(update).length === 0) {
    const { data: row, error } = await sb.from("work_calendar_holidays").select("*").eq("id", id).single();
    if (error) throwSupabaseError(error);
    return workCalendarHolidayRowToDomain(row as WorkCalendarHolidayRow);
  }
  const { data: row, error } = await sb
    .from("work_calendar_holidays")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throwSupabaseError(error);
  return workCalendarHolidayRowToDomain(row as WorkCalendarHolidayRow);
}

export async function deleteWorkCalendarHoliday(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("work_calendar_holidays").delete().eq("id", id);
  if (error) throwSupabaseError(error);
}

// --- Horario de verano (7 h intensivo) — rangos de fechas ---

function parseOneDate(raw: string): string | null {
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t)) {
    const [d, m, y] = t.split("/").map((x) => parseInt(x, 10));
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return null;
}

function assertRangeInCalendarYear(dateStart: string, dateEnd: string, calendarYear: number): void {
  const y1 = parseInt(dateStart.slice(0, 4), 10);
  const y2 = parseInt(dateEnd.slice(0, 4), 10);
  if (y1 !== calendarYear || y2 !== calendarYear) {
    throw new Error("Las fechas del rango deben pertenecer al año seleccionado.");
  }
  if (dateStart > dateEnd) {
    throw new Error("La fecha de fin debe ser igual o posterior a la de inicio.");
  }
}

export async function fetchWorkCalendarSummerDays(year: number): Promise<WorkCalendarSummerRangeRecord[]> {
  const sb = requireSupabase();
  const { data: rows, error } = await sb
    .from("work_calendar_summer_days")
    .select("*")
    .eq("calendar_year", year)
    .order("date_start", { ascending: true });
  if (error) throwSupabaseError(error);
  return (rows ?? []).map((r) => workCalendarSummerRangeRowToDomain(r as WorkCalendarSummerRangeRow));
}

export async function createWorkCalendarSummerRange(
  row: Omit<WorkCalendarSummerRangeRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }
): Promise<WorkCalendarSummerRangeRecord> {
  const sb = requireSupabase();
  assertRangeInCalendarYear(row.dateStart, row.dateEnd, row.calendarYear);
  const { data: inserted, error } = await sb
    .from("work_calendar_summer_days")
    .insert({
      calendar_year: row.calendarYear,
      site_id: row.siteId,
      date_start: row.dateStart,
      date_end: row.dateEnd,
      label: row.label.trim(),
    })
    .select("*")
    .single();
  if (error) throwSupabaseError(error);
  return workCalendarSummerRangeRowToDomain(inserted as WorkCalendarSummerRangeRow);
}

export async function updateWorkCalendarSummerRange(
  id: string,
  patch: Partial<Pick<WorkCalendarSummerRangeRecord, "dateStart" | "dateEnd" | "label">>
): Promise<WorkCalendarSummerRangeRecord> {
  const sb = requireSupabase();
  const { data: existing, error: fetchErr } = await sb
    .from("work_calendar_summer_days")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchErr) throwSupabaseError(fetchErr);
  const ex = existing as WorkCalendarSummerRangeRow;
  const mergedStart = patch.dateStart ?? ex.date_start;
  const mergedEnd = patch.dateEnd ?? ex.date_end;
  assertRangeInCalendarYear(mergedStart, mergedEnd, ex.calendar_year);

  const update: Record<string, string | number> = {};
  if (patch.dateStart !== undefined) update.date_start = patch.dateStart;
  if (patch.dateEnd !== undefined) update.date_end = patch.dateEnd;
  if (patch.label !== undefined) update.label = patch.label.trim();
  if (Object.keys(update).length === 0) {
    return workCalendarSummerRangeRowToDomain(ex);
  }
  const { data: r, error } = await sb
    .from("work_calendar_summer_days")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throwSupabaseError(error);
  return workCalendarSummerRangeRowToDomain(r as WorkCalendarSummerRangeRow);
}

export async function deleteWorkCalendarSummerRange(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("work_calendar_summer_days").delete().eq("id", id);
  if (error) throwSupabaseError(error);
}

/** Una línea por rango: fecha_inicio;fecha_fin o fecha_inicio,fecha_fin (YYYY-MM-DD o DD/MM/AAAA). # comentarios. */
export function parseSummerRangeImportLines(text: string): { dateStart: string; dateEnd: string }[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: { dateStart: string; dateEnd: string }[] = [];
  for (const line of lines) {
    if (line.startsWith("#")) continue;
    const parts = line.split(/[;]/).map((p) => p.trim());
    let a: string | undefined;
    let b: string | undefined;
    if (parts.length >= 2) {
      a = parts[0];
      b = parts[1];
    } else {
      const commaParts = line.split(",").map((p) => p.trim());
      if (commaParts.length === 2) {
        a = commaParts[0];
        b = commaParts[1];
      }
    }
    if (!a || !b) continue;
    const d1 = parseOneDate(a);
    const d2 = parseOneDate(b);
    if (d1 && d2 && d1 <= d2) out.push({ dateStart: d1, dateEnd: d2 });
  }
  return out;
}

export async function bulkImportWorkCalendarSummerRanges(
  calendarYear: number,
  siteId: string,
  ranges: { dateStart: string; dateEnd: string }[]
): Promise<{ inserted: number; skipped: number }> {
  const sb = requireSupabase();
  let inserted = 0;
  let skipped = 0;
  for (const r of ranges) {
    try {
      assertRangeInCalendarYear(r.dateStart, r.dateEnd, calendarYear);
    } catch {
      skipped++;
      continue;
    }
    const { error } = await sb.from("work_calendar_summer_days").insert({
      calendar_year: calendarYear,
      site_id: siteId,
      date_start: r.dateStart,
      date_end: r.dateEnd,
      label: "",
    });
    if (error) {
      const msg = getErrorMessage(error);
      if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("23505")) {
        skipped++;
        continue;
      }
      throwSupabaseError(error);
    }
    inserted++;
  }
  return { inserted, skipped };
}

export type BulkHolidayRow = { holidayDate: string; label: string; holidayKind: WorkCalendarHolidayKind };

const DEFAULT_KIND: WorkCalendarHolidayKind = "NACIONAL";

/** Normaliza token (nacional / autonómico / local) al enum de BD. */
export function parseHolidayKindToken(token: string): WorkCalendarHolidayKind | null {
  const s = token
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (s === "nacional" || s === "national") return "NACIONAL";
  if (
    s === "autonomico" ||
    s === "autonomica" ||
    s === "ccaa" ||
    s === "comunidad" ||
    s === "regional" ||
    s === "autonomic"
  )
    return "AUTONOMICO";
  if (s === "local" || s === "locales" || s === "municipal") return "LOCAL";
  return null;
}

/** Parsea líneas CSV: fecha [, descripción] [, tipo]. Tipos: nacional, autonómico, local. Ignora vacías y #. */
export function parseHolidayImportLines(text: string): BulkHolidayRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: BulkHolidayRow[] = [];
  for (const line of lines) {
    if (line.startsWith("#")) continue;
    const parts = line.split(/[;,]/).map((p) => p.trim());
    const raw = parts[0];
    if (!raw) continue;
    let iso: string;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      iso = raw;
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
      const [d, m, y] = raw.split("/").map((x) => parseInt(x, 10));
      const mm = String(m).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      iso = `${y}-${mm}-${dd}`;
    } else {
      continue;
    }
    const rest = parts.slice(1);
    let label = "";
    let kind: WorkCalendarHolidayKind = DEFAULT_KIND;
    if (rest.length === 0) {
      out.push({ holidayDate: iso, label, holidayKind: kind });
      continue;
    }
    if (rest.length === 1) {
      const k = parseHolidayKindToken(rest[0]);
      if (k) kind = k;
      else label = rest[0];
      out.push({ holidayDate: iso, label, holidayKind: kind });
      continue;
    }
    const last = rest[rest.length - 1]!;
    const lastAsKind = parseHolidayKindToken(last);
    if (lastAsKind) {
      kind = lastAsKind;
      label = rest.slice(0, -1).join(", ").trim();
    } else {
      label = rest.join(", ").trim();
    }
    out.push({ holidayDate: iso, label, holidayKind: kind });
  }
  return out;
}

export async function bulkImportWorkCalendarHolidays(
  calendarYear: number,
  siteId: string,
  rows: BulkHolidayRow[]
): Promise<{ inserted: number; skipped: number }> {
  const sb = requireSupabase();
  let inserted = 0;
  let skipped = 0;
  for (const r of rows) {
    const y = r.holidayDate.slice(0, 4);
    if (Number(y) !== calendarYear) {
      skipped++;
      continue;
    }
    const { error } = await sb.from("work_calendar_holidays").insert({
      calendar_year: calendarYear,
      site_id: siteId,
      holiday_date: r.holidayDate,
      holiday_kind: r.holidayKind,
      label: r.label,
    });
    if (error) {
      const msg = getErrorMessage(error);
      if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("23505")) {
        skipped++;
        continue;
      }
      throwSupabaseError(error);
    }
    inserted++;
  }
  return { inserted, skipped };
}
