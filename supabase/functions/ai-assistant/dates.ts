/** Utilidades de fechas (ISO `YYYY-MM-DD`, sin zona horaria). */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const MAX_RANGE_DAYS = 731;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function toUtcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = toUtcDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

export function daysBetween(startIso: string, endIso: string): number {
  const a = toUtcDate(startIso).getTime();
  const b = toUtcDate(endIso).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Hoy en Europe/Madrid como `YYYY-MM-DD`. */
export function todayMadridIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export type Period = { start: string; end: string };

/** Valida un rango: formato, orden y amplitud máxima. Lanza `Error` con mensaje corto. */
export function validatePeriod(start: string, end: string): Period {
  if (!isIsoDate(start) || !isIsoDate(end)) throw new Error("invalid_date_format");
  if (start > end) throw new Error("start_after_end");
  if (start < "2000-01-01") throw new Error("date_too_old");
  const span = daysBetween(start, end);
  if (span > MAX_RANGE_DAYS) throw new Error("range_too_wide");
  return { start, end };
}

/** Período inmediatamente anterior con la misma duración (en días). */
export function previousPeriod(p: Period): Period {
  const span = daysBetween(p.start, p.end);
  const end = addDays(p.start, -1);
  const start = addDays(end, -span);
  return { start, end };
}

/** Mes `YYYY-MM` de una fecha ISO. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function percentChange(prev: number, curr: number): number | null {
  if (!Number.isFinite(prev) || prev === 0) return null;
  return Math.round(((curr - prev) / Math.abs(prev)) * 1000) / 10;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
