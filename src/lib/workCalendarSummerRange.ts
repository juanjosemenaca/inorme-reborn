/**
 * Rangos de horario de verano: solo lun–vie dentro del rango (inclusive) cuentan como 7 h.
 * Sábados y domingos no se marcan en verde por el verano (siguen como fin de semana si no son festivo).
 */

function formatLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type SummerRangeInput = { dateStart: string; dateEnd: string; label?: string };

/** Expande rangos a días ISO laborables (lun–vie) entre inicio y fin inclusive. */
export function expandSummerRangesToWeekdayIsoSet(
  ranges: SummerRangeInput[]
): { isoSet: Set<string>; labelByIso: Map<string, string> } {
  const isoSet = new Set<string>();
  const labelByIso = new Map<string, string>();

  for (const r of ranges) {
    const start = new Date(r.dateStart + "T12:00:00");
    const end = new Date(r.dateEnd + "T12:00:00");
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) continue;

    const cur = new Date(start);
    while (cur <= end) {
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) {
        const iso = formatLocalYMD(cur);
        isoSet.add(iso);
        const lab = r.label?.trim();
        if (lab && !labelByIso.has(iso)) labelByIso.set(iso, lab);
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  return { isoSet, labelByIso };
}
