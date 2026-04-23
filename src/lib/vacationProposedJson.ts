import { isoDateOnlyFromDb, parseIsoDateYmdCalendar } from "@/lib/isoDate";
import type { VacationDayEntry } from "@/types/vacationDays";

type LegacyJson = string[];
type NewJson = { d: string; c?: number }[];

/**
 * Lee proposed_dates o previous_approved_dates (legado: array de string ISO; nuevo: [{d, c?}]).
 */
export function parseVacationProposedJson(raw: unknown): VacationDayEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: VacationDayEntry[] = [];
  for (const v of raw) {
    if (typeof v === "string") {
      const d = isoDateOnlyFromDb(v);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        out.push({ date: d, carryoverFromYear: null });
      }
      continue;
    }
    if (v && typeof v === "object" && "d" in v && typeof (v as { d: unknown }).d === "string") {
      const d = isoDateOnlyFromDb((v as { d: string }).d);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      const c = (v as { c?: unknown }).c;
      const carry =
        typeof c === "number" && Number.isInteger(c) && c >= 2000 && c < 2100 ? c : null;
      out.push({ date: d, carryoverFromYear: carry });
    }
  }
  const byDate = new Map<string, VacationDayEntry>();
  for (const e of out) {
    if (!byDate.has(e.date)) byDate.set(e.date, e);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function vacationProposedToJson(entries: VacationDayEntry[]): NewJson {
  return entries.map((e) =>
    e.carryoverFromYear != null
      ? { d: e.date, c: e.carryoverFromYear }
      : { d: e.date }
  );
}

export function entryDatesForDiff(entries: VacationDayEntry[]): string[] {
  return entries.map((e) => e.date);
}

export function normalizeVacationEntries(entries: VacationDayEntry[]): VacationDayEntry[] {
  const m = new Map<string, VacationDayEntry>();
  for (const e of entries) {
    const d = parseIsoDateYmdCalendar(e.date).iso;
    const c = e.carryoverFromYear;
    m.set(d, { date: d, carryoverFromYear: c == null || !Number.isFinite(c) ? null : c });
  }
  return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function vacationEntriesEqual(a: VacationDayEntry[], b: VacationDayEntry[]): boolean {
  const A = normalizeVacationEntries(a);
  const B = normalizeVacationEntries(b);
  if (A.length !== B.length) return false;
  for (let i = 0; i < A.length; i++) {
    if (A[i].date !== B[i].date) return false;
    if (A[i].carryoverFromYear !== B[i].carryoverFromYear) return false;
  }
  return true;
}
