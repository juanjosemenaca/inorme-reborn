import { format, parseISO, subMonths } from "date-fns";

/** Alineado con la BD: (end_date - interval '2 months') para la fecha de aviso por defecto. */
export function defaultProjectEndNoticeAtIso(endDateYmd: string): string | null {
  const t = endDateYmd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  return format(subMonths(parseISO(t), 2), "yyyy-MM-dd");
}
