import { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { isWeekendIso } from "@/lib/calendarIso";
import { isoDateOnlyFromDb } from "@/lib/isoDate";
import type { WorkCalendarHolidayKind, WorkCalendarHolidayRecord } from "@/types/workCalendars";

type DayVisual =
  | { type: "empty" }
  | { type: "day"; day: number; iso: string; holiday?: WorkCalendarHolidayRecord };

/** Lunes = primera columna (como en el Excel de referencia). */
function buildMonthCells(year: number, month: number): DayVisual[][] {
  const first = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0).getDate();
  const mondayOffset = (first.getDay() + 6) % 7;
  const flat: DayVisual[] = [];
  for (let i = 0; i < mondayOffset; i++) flat.push({ type: "empty" });
  for (let d = 1; d <= lastDay; d++) {
    const mm = String(month).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    flat.push({ type: "day", day: d, iso: `${year}-${mm}-${dd}` });
  }
  while (flat.length % 7 !== 0) flat.push({ type: "empty" });
  const rows: DayVisual[][] = [];
  for (let i = 0; i < flat.length; i += 7) {
    rows.push(flat.slice(i, i + 7));
  }
  return rows;
}

/** Viernes (día 5 en JS si domingo = 0). */
function isFridayIso(iso: string): boolean {
  return new Date(iso + "T12:00:00").getDay() === 5;
}

const kindCellClass: Record<WorkCalendarHolidayKind, string> = {
  NACIONAL:
    "bg-red-100 text-red-950 border-red-300/80 dark:bg-red-950/40 dark:text-red-100 dark:border-red-800/60",
  AUTONOMICO:
    "bg-amber-100 text-amber-950 border-amber-300/80 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-800/60",
  LOCAL:
    "bg-violet-100 text-violet-950 border-violet-300/80 dark:bg-violet-950/40 dark:text-violet-100 dark:border-violet-800/60",
};

function isSummerIntensiveDay(iso: string, summerIsoSet: ReadonlySet<string>): boolean {
  return summerIsoSet.has(iso);
}

function cellClass(
  iso: string,
  holiday: WorkCalendarHolidayRecord | undefined,
  weekendNoHoliday: string,
  monThuClass: string,
  sevenHourClass: string,
  summerIsoSet: ReadonlySet<string>
): string {
  if (holiday) return cn("border font-medium", kindCellClass[holiday.holidayKind]);
  if (isWeekendIso(iso)) return cn("border", weekendNoHoliday);
  if (isFridayIso(iso) || isSummerIntensiveDay(iso, summerIsoSet)) return cn("border", sevenHourClass);
  return cn("border", monThuClass);
}

type Props = {
  year: number;
  holidays: WorkCalendarHolidayRecord[];
  /** Fechas ISO con jornada 7 h por horario de verano (mismo verde que viernes). */
  summerIsoSet: ReadonlySet<string>;
  /** Notas opcionales por fecha (desde el alta de horario verano). */
  summerLabelByIso?: ReadonlyMap<string, string>;
  locale: string;
  monthTitle: (monthIndex: number) => string;
  kindLabel: (k: WorkCalendarHolidayKind) => string;
  legendCaption: string;
  /** Lun–jue, jornada 8,75 h (fondo blanco / neutro). */
  legendMonThu: string;
  /** Leyenda única del cuadro verde: viernes + horario verano 7 h. */
  legendSevenHour: string;
  legendWeekend: string;
  legendNational: string;
  legendRegional: string;
  legendLocal: string;
  tooltipFriday7h: string;
  tooltipSummer7h: string;
  /** Días marcados como vacaciones (vista trabajador). */
  vacationIsoSet?: ReadonlySet<string>;
  /** Subconjunto: vacaciones de traspaso (año anterior), otro color. */
  vacationCarryoverIsoSet?: ReadonlySet<string>;
  /** Subconjunto de vacaciones ya disfrutadas (pasadas) para marcar visualmente. */
  vacationPastIsoSet?: ReadonlySet<string>;
  onVacationDayClick?: (iso: string) => void;
  vacationDayCanClick?: (iso: string) => boolean;
  vacationLegendLabel?: string;
  vacationTooltipLine?: string;
  vacationCarryoverLegendLabel?: string;
  vacationCarryoverTooltipLine?: string;
  /** Número de entradas de agenda personal por fecha ISO (día local). */
  agendaCountByIso?: ReadonlyMap<string, number>;
  agendaLegendLabel?: string;
};

export function WorkCalendarYearGrid({
  year,
  holidays,
  summerIsoSet,
  summerLabelByIso,
  locale,
  monthTitle,
  kindLabel,
  legendCaption,
  legendMonThu,
  legendSevenHour,
  legendWeekend,
  legendNational,
  legendRegional,
  legendLocal,
  tooltipFriday7h,
  tooltipSummer7h,
  vacationIsoSet,
  vacationCarryoverIsoSet,
  vacationPastIsoSet,
  onVacationDayClick,
  vacationDayCanClick,
  vacationLegendLabel,
  vacationTooltipLine,
  vacationCarryoverLegendLabel,
  vacationCarryoverTooltipLine,
  agendaCountByIso,
  agendaLegendLabel,
}: Props) {
  const todayIso = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  const byDate = useMemo(() => {
    const m = new Map<string, WorkCalendarHolidayRecord>();
    for (const h of holidays) {
      m.set(isoDateOnlyFromDb(h.holidayDate), h);
    }
    return m;
  }, [holidays]);

  const weekDayLabels = useMemo(() => {
    const refMonday = new Date(year, 0, 5);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(refMonday);
      d.setDate(refMonday.getDate() + i);
      return d.toLocaleDateString(locale, { weekday: "narrow" });
    });
  }, [year, locale]);

  const weekendClass =
    "bg-orange-50 text-orange-950/90 border-orange-200/90 dark:bg-orange-950/25 dark:text-orange-100 dark:border-orange-800/50";
  const monThuClass =
    "bg-white text-foreground border-border/70 dark:bg-background dark:text-foreground dark:border-border";
  const sevenHourClass =
    "bg-emerald-50 text-emerald-950/90 border-emerald-300/80 dark:bg-emerald-950/30 dark:text-emerald-100 dark:border-emerald-800/50";
  const vacationRingClass =
    "ring-2 ring-sky-600/85 ring-inset shadow-[inset_0_0_0_1px_rgba(2,132,199,0.35)] bg-sky-50/90 dark:bg-sky-950/35 dark:ring-sky-500/80";
  const vacationCarryoverRingClass =
    "ring-2 ring-amber-600/85 ring-inset shadow-[inset_0_0_0_1px_rgba(217,119,6,0.35)] bg-amber-50/90 dark:bg-amber-950/35 dark:ring-amber-500/80";
  const vacationPastClass = "line-through decoration-1 opacity-85";
  const pastDayClass = "line-through decoration-1 opacity-80";
  const todayClass = "font-bold";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground items-center border rounded-lg px-3 py-2 bg-muted/30">
          <span className="font-medium text-foreground">{legendCaption}</span>
          <span className="flex items-center gap-1.5">
            <span className={cn("inline-block size-4 rounded border", monThuClass)} aria-hidden />
            <span>{legendMonThu}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className={cn("inline-block size-4 rounded border", sevenHourClass)} aria-hidden />
            <span>{legendSevenHour}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className={cn("inline-block size-4 rounded border", weekendClass)} aria-hidden />
            <span>{legendWeekend}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className={cn("inline-block size-4 rounded border", kindCellClass.NACIONAL)} aria-hidden />
            <span>{legendNational}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className={cn("inline-block size-4 rounded border", kindCellClass.AUTONOMICO)} aria-hidden />
            <span>{legendRegional}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className={cn("inline-block size-4 rounded border", kindCellClass.LOCAL)} aria-hidden />
            <span>{legendLocal}</span>
          </span>
          {vacationLegendLabel ? (
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block size-4 rounded border border-sky-600/60 bg-sky-100 dark:bg-sky-950/50"
                aria-hidden
              />
              <span>{vacationLegendLabel}</span>
            </span>
          ) : null}
          {vacationCarryoverLegendLabel ? (
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block size-4 rounded border border-amber-600/60 bg-amber-100 dark:bg-amber-950/50"
                aria-hidden
              />
              <span>{vacationCarryoverLegendLabel}</span>
            </span>
          ) : null}
          {agendaLegendLabel ? (
            <span className="flex items-center gap-1.5">
              <span className="relative inline-flex size-4 items-end justify-center rounded border border-violet-400/70 bg-violet-50 dark:bg-violet-950/40">
                <span className="mb-0.5 size-1.5 rounded-full bg-violet-600 dark:bg-violet-400" aria-hidden />
              </span>
              <span>{agendaLegendLabel}</span>
            </span>
          ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
            const rows = buildMonthCells(year, month);
            return (
              <div
                key={month}
                className="rounded-lg border bg-card p-2 shadow-sm"
              >
                <p className="text-center font-semibold text-sm mb-2 capitalize">{monthTitle(month - 1)}</p>
                <div className="grid grid-cols-7 gap-px text-[10px] sm:text-xs">
                  {weekDayLabels.map((w, idx) => (
                    <div
                      key={idx}
                      className="text-center font-medium text-muted-foreground py-1 px-0.5 truncate"
                      title={w}
                    >
                      {w}
                    </div>
                  ))}
                  {rows.map((row, ri) =>
                    row.map((cell, ci) => {
                      if (cell.type === "empty") {
                        return (
                          <div
                            key={`${ri}-${ci}`}
                            className="min-h-[1.75rem] sm:min-h-[2rem] rounded-sm bg-muted/20"
                          />
                        );
                      }
                      const h = byDate.get(cell.iso);
                      const cls = cellClass(cell.iso, h, weekendClass, monThuClass, sevenHourClass, summerIsoSet);
                      const isVac = vacationIsoSet?.has(cell.iso) ?? false;
                      const isVacCarry = vacationCarryoverIsoSet?.has(cell.iso) ?? false;
                      const isVacPast = vacationPastIsoSet?.has(cell.iso) ?? false;
                      const isPast = cell.iso < todayIso;
                      const isToday = cell.iso === todayIso;
                      const canVac =
                        !!onVacationDayClick && (vacationDayCanClick ? vacationDayCanClick(cell.iso) : true);
                      const prettyDate = new Date(cell.iso + "T12:00:00").toLocaleDateString(locale, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      });
                      const tooltipLines: string[] = [prettyDate];
                      if (h) {
                        tooltipLines.push(kindLabel(h.holidayKind));
                        if (h.label) tooltipLines.push(h.label);
                      } else if (isWeekendIso(cell.iso)) {
                        tooltipLines.push(legendWeekend);
                      } else {
                        const fri = isFridayIso(cell.iso);
                        const sum = isSummerIntensiveDay(cell.iso, summerIsoSet);
                        if (fri && sum) {
                          tooltipLines.push(tooltipFriday7h);
                          tooltipLines.push(tooltipSummer7h);
                          const noteFs = summerLabelByIso?.get(cell.iso);
                          if (noteFs) tooltipLines.push(noteFs);
                        } else if (fri) {
                          tooltipLines.push(tooltipFriday7h);
                        } else if (sum) {
                          tooltipLines.push(tooltipSummer7h);
                          const note = summerLabelByIso?.get(cell.iso);
                          if (note) tooltipLines.push(note);
                        } else {
                          tooltipLines.push(legendMonThu);
                        }
                      }
                      if (isVac && isVacCarry && vacationCarryoverTooltipLine) {
                        tooltipLines.push(vacationCarryoverTooltipLine);
                      } else if (isVac && !isVacCarry && vacationTooltipLine) {
                        tooltipLines.push(vacationTooltipLine);
                      }
                      const agendaN = agendaCountByIso?.get(cell.iso) ?? 0;
                      if (agendaN > 0 && agendaLegendLabel) {
                        tooltipLines.push(`${agendaLegendLabel}: ${agendaN}`);
                      }

                      const cellInteractiveCls =
                        onVacationDayClick && canVac
                          ? "cursor-pointer hover:brightness-[0.98] active:scale-[0.98]"
                          : onVacationDayClick && !canVac
                            ? "cursor-not-allowed opacity-70"
                            : "cursor-default";

                      const cellClassName = cn(
                        "min-h-[1.75rem] sm:min-h-[2rem] w-full flex items-center justify-center rounded-sm tabular-nums border",
                        cls,
                        isVac && (isVacCarry ? vacationCarryoverRingClass : vacationRingClass),
                        isPast && pastDayClass,
                        isToday && todayClass,
                        isVac && isVacPast && vacationPastClass,
                        cellInteractiveCls
                      );

                      return (
                        <Tooltip key={cell.iso}>
                          <TooltipTrigger asChild>
                            {onVacationDayClick ? (
                              <button
                                type="button"
                                className={cellClassName}
                                onClick={
                                  canVac ? () => onVacationDayClick(cell.iso) : undefined
                                }
                                disabled={!canVac}
                              >
                                <span className="relative flex flex-col items-center justify-center gap-0.5">
                                  <span>{cell.day}</span>
                                  {(agendaCountByIso?.get(cell.iso) ?? 0) > 0 ? (
                                    <span className="size-1.5 rounded-full bg-violet-600 dark:bg-violet-400" aria-hidden />
                                  ) : null}
                                </span>
                              </button>
                            ) : (
                              <div className={cellClassName}>
                                <span className="relative flex flex-col items-center justify-center gap-0.5">
                                  <span>{cell.day}</span>
                                  {(agendaCountByIso?.get(cell.iso) ?? 0) > 0 ? (
                                    <span className="size-1.5 rounded-full bg-violet-600 dark:bg-violet-400" aria-hidden />
                                  ) : null}
                                </span>
                              </div>
                            )}
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-xs whitespace-pre-line">{tooltipLines.join("\n")}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
