/** Día de vacaciones en calendario (año de la fecha = año natural al que aplica). */
export interface VacationDayEntry {
  date: string;
  /** Año de origen del cupo aprobado para traspaso; null = vacaciones del cupo anual del año de `date`. */
  carryoverFromYear: number | null;
}
