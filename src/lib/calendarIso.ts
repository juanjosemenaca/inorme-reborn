/** Fecha ISO `YYYY-MM-DD` (mediodía local para evitar saltos por zona). */
export function isWeekendIso(iso: string): boolean {
  const d = new Date(iso + "T12:00:00");
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}
