import type { DashboardPeriod } from "@/lib/dashboard/catalog";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Hoy Europe/Madrid como YYYY-MM-DD. */
export function todayMadridIso(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function resolvePeriod(period: DashboardPeriod | undefined, today = todayMadridIso()): { start: string; end: string } {
  const end = new Date(`${today}T00:00:00Z`);
  switch (period) {
    case "previous_day": {
      const d = new Date(end);
      d.setUTCDate(d.getUTCDate() - 1);
      const s = iso(d);
      return { start: s, end: s };
    }
    case "previous_month": {
      const firstThis = startOfMonth(end);
      const lastPrev = new Date(firstThis);
      lastPrev.setUTCDate(0);
      const firstPrev = startOfMonth(lastPrev);
      return { start: iso(firstPrev), end: iso(lastPrev) };
    }
    case "last_30_days": {
      const d = new Date(end);
      d.setUTCDate(d.getUTCDate() - 29);
      return { start: iso(d), end: today };
    }
    case "last_12_months": {
      const d = new Date(end);
      d.setUTCFullYear(d.getUTCFullYear() - 1);
      d.setUTCDate(d.getUTCDate() + 1);
      return { start: iso(d), end: today };
    }
    case "current_year":
      return { start: `${end.getUTCFullYear()}-01-01`, end: today };
    case "current_month":
    default:
      return { start: iso(startOfMonth(end)), end: today };
  }
}

export function previousEqualPeriod(start: string, end: string): { start: string; end: string } {
  const a = new Date(`${start}T00:00:00Z`).getTime();
  const b = new Date(`${end}T00:00:00Z`).getTime();
  const span = Math.round((b - a) / 86_400_000);
  const prevEnd = new Date(`${start}T00:00:00Z`);
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setUTCDate(prevStart.getUTCDate() - span);
  return { start: iso(prevStart), end: iso(prevEnd) };
}
