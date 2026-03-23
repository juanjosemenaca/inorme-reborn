/** Sede / calendario laboral corporativo. */
export type WorkCalendarScope = "BARCELONA" | "MADRID" | "ARRASATE_MONDRAGON";

export const WORK_CALENDAR_SCOPES: WorkCalendarScope[] = [
  "BARCELONA",
  "MADRID",
  "ARRASATE_MONDRAGON",
];

/** Ámbito del festivo respecto al calendario laboral. */
export type WorkCalendarHolidayKind = "NACIONAL" | "AUTONOMICO" | "LOCAL";

export const WORK_CALENDAR_HOLIDAY_KINDS: WorkCalendarHolidayKind[] = [
  "NACIONAL",
  "AUTONOMICO",
  "LOCAL",
];

/** Festivo o día no laborable registrado para un año y sede. */
export interface WorkCalendarHolidayRecord {
  id: string;
  calendarYear: number;
  scope: WorkCalendarScope;
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
  scope: WorkCalendarScope;
  /** Inicio del rango ISO `YYYY-MM-DD` (inclusive). */
  dateStart: string;
  /** Fin del rango ISO `YYYY-MM-DD` (inclusive). */
  dateEnd: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}
