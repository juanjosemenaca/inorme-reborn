/** Ámbito del festivo respecto al calendario laboral. */
export type WorkCalendarHolidayKind = "NACIONAL" | "AUTONOMICO" | "LOCAL";

export const WORK_CALENDAR_HOLIDAY_KINDS: WorkCalendarHolidayKind[] = [
  "NACIONAL",
  "AUTONOMICO",
  "LOCAL",
];

/** Sede / calendario laboral (dinámico en BD; Barcelona, Madrid y Arrasate son sedes «de sistema»). */
export interface WorkCalendarSiteRecord {
  id: string;
  /** Identificador estable (p. ej. BARCELONA o VALENCIA). */
  slug: string;
  name: string;
  /** Días de vacaciones por defecto al asignar esta sede a un trabajador. */
  vacationDaysDefault: number;
  /** No se puede eliminar desde la app. */
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Festivo o día no laborable registrado para un año y sede. */
export interface WorkCalendarHolidayRecord {
  id: string;
  calendarYear: number;
  siteId: string;
  /** Fecha en formato ISO `YYYY-MM-DD`. */
  holidayDate: string;
  /** Nacional, autonómico o local. */
  holidayKind: WorkCalendarHolidayKind;
  /** Descripción libre (ej. nombre del festivo). */
  label: string;
  createdAt: string;
  updatedAt: string;
}

/** Rango de horario de verano (7 h intensivo); lun–vie entre fechas inclusive en la vista. */
export interface WorkCalendarSummerRangeRecord {
  id: string;
  calendarYear: number;
  siteId: string;
  /** Inicio del rango ISO `YYYY-MM-DD` (inclusive). */
  dateStart: string;
  /** Fin del rango ISO `YYYY-MM-DD` (inclusive). */
  dateEnd: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}
