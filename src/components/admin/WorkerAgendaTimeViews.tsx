import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isWeekendIso } from "@/lib/calendarIso";
import { isoDateOnlyFromDb } from "@/lib/isoDate";
import type { WorkCalendarHolidayKind, WorkCalendarHolidayRecord } from "@/types/workCalendars";
import type { WorkerAgendaItemRecord } from "@/types/agenda";

/** Lunes = primera columna. */
export function buildMonthGridCells(year: number, month1to12: number): { type: "empty" } | { type: "day"; day: number; iso: string }[][] {
  const first = new Date(year, month1to12 - 1, 1);
  const lastDay = new Date(year, month1to12, 0).getDate();
  const mondayOffset = (first.getDay() + 6) % 7;
  const flat: ({ type: "empty" } | { type: "day"; day: number; iso: string })[] = [];
  for (let i = 0; i < mondayOffset; i++) flat.push({ type: "empty" });
  for (let d = 1; d <= lastDay; d++) {
    const mm = String(month1to12).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    flat.push({ type: "day", day: d, iso: `${year}-${mm}-${dd}` });
  }
  while (flat.length % 7 !== 0) flat.push({ type: "empty" });
  const rows: typeof flat[] = [];
  for (let i = 0; i < flat.length; i += 7) {
    rows.push(flat.slice(i, i + 7));
  }
  return rows;
}

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
  if (isFridayIso(iso) || summerIsoSet.has(iso)) return cn("border", sevenHourClass);
  return cn("border", monThuClass);
}

const weekendClass =
  "bg-orange-50 text-orange-950/90 border-orange-200/90 dark:bg-orange-950/25 dark:text-orange-100 dark:border-orange-800/50";
const monThuClass =
  "bg-white text-foreground border-border/70 dark:bg-background dark:text-foreground dark:border-border";
const sevenHourClass =
  "bg-emerald-50 text-emerald-950/90 border-emerald-300/80 dark:bg-emerald-950/30 dark:text-emerald-100 dark:border-emerald-800/50";
const vacationRingClass =
  "ring-2 ring-sky-600/85 ring-inset shadow-[inset_0_0_0_1px_rgba(2,132,199,0.35)] bg-sky-50/90 dark:bg-sky-950/35 dark:ring-sky-500/80";

export function groupAgendaItemsByLocalDay(items: WorkerAgendaItemRecord[]): Map<string, WorkerAgendaItemRecord[]> {
  const m = new Map<string, WorkerAgendaItemRecord[]>();
  for (const it of items) {
    const d = new Date(it.startsAt);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const arr = m.get(k) ?? [];
    arr.push(it);
    m.set(k, arr);
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }
  return m;
}

export function startOfWeekMonday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
}

export function dateToLocalYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

type MonthNavProps = {
  displayMonth: Date;
  locale: string;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
};

function MonthNavBar({ displayMonth, locale, onPrev, onNext, prevLabel, nextLabel }: MonthNavProps) {
  const label = displayMonth.toLocaleDateString(locale, { month: "long", year: "numeric" });
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-between">
      <Button type="button" variant="outline" size="icon" onClick={onPrev} aria-label={prevLabel}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[12rem] text-center text-base font-semibold capitalize">{label}</span>
      <Button type="button" variant="outline" size="icon" onClick={onNext} aria-label={nextLabel}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export type AgendaMonthViewProps = {
  displayMonth: Date;
  locale: string;
  holidays: WorkCalendarHolidayRecord[];
  summerIsoSet: ReadonlySet<string>;
  vacationIsoSet: ReadonlySet<string>;
  itemsByDay: Map<string, WorkerAgendaItemRecord[]>;
  weekDayLabels: string[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onDayBackgroundClick: (iso: string) => void;
  onItemClick: (item: WorkerAgendaItemRecord) => void;
  prevMonthLabel: string;
  nextMonthLabel: string;
  maxItemsPerCell?: number;
};

export function AgendaMonthView({
  displayMonth,
  locale,
  holidays,
  summerIsoSet,
  vacationIsoSet,
  itemsByDay,
  weekDayLabels,
  onPrevMonth,
  onNextMonth,
  onDayBackgroundClick,
  onItemClick,
  prevMonthLabel,
  nextMonthLabel,
  maxItemsPerCell = 3,
}: AgendaMonthViewProps) {
  const y = displayMonth.getFullYear();
  const month = displayMonth.getMonth() + 1;
  const rows = useMemo(() => buildMonthGridCells(y, month), [y, month]);

  const byDate = useMemo(() => {
    const m = new Map<string, WorkCalendarHolidayRecord>();
    for (const h of holidays) {
      m.set(isoDateOnlyFromDb(h.holidayDate), h);
    }
    return m;
  }, [holidays]);

  const todayIso = useMemo(() => dateToLocalYmd(new Date()), []);

  return (
    <div className="space-y-4">
      <MonthNavBar
        displayMonth={displayMonth}
        locale={locale}
        onPrev={onPrevMonth}
        onNext={onNextMonth}
        prevLabel={prevMonthLabel}
        nextLabel={nextMonthLabel}
      />
      <div className="grid grid-cols-7 gap-px rounded-lg border bg-border text-xs sm:text-sm">
        {weekDayLabels.map((w, idx) => (
          <div
            key={idx}
            className="bg-muted/50 px-1 py-2 text-center font-medium text-muted-foreground first:rounded-tl-lg last:rounded-tr-lg sm:px-2"
          >
            {w}
          </div>
        ))}
        {rows.flatMap((row, ri) =>
          row.map((cell, ci) => {
            if (cell.type === "empty") {
              return (
                <div
                  key={`e-${ri}-${ci}`}
                  className="min-h-[5.5rem] bg-muted/20 sm:min-h-[6.5rem]"
                  aria-hidden
                />
              );
            }
            const iso = cell.iso;
            const h = byDate.get(iso);
            const cls = cellClass(iso, h, weekendClass, monThuClass, sevenHourClass, summerIsoSet);
            const isVac = vacationIsoSet.has(iso);
            const isToday = iso === todayIso;
            const items = itemsByDay.get(iso) ?? [];
            const shown = items.slice(0, maxItemsPerCell);
            const more = items.length - shown.length;

            return (
              <div
                key={iso}
                className={cn(
                  "flex min-h-[5.5rem] flex-col border-b border-r border-border/80 bg-card p-1 sm:min-h-[6.5rem] sm:p-1.5",
                  cls,
                  isVac && vacationRingClass,
                  isToday && "ring-2 ring-primary ring-inset"
                )}
              >
                <button
                  type="button"
                  className={cn(
                    "mb-1 w-full rounded px-0.5 text-left text-[11px] font-semibold tabular-nums hover:bg-black/5 dark:hover:bg-white/10 sm:text-xs",
                    isToday && "text-primary"
                  )}
                  onClick={() => onDayBackgroundClick(iso)}
                >
                  {cell.day}
                </button>
                <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                  {shown.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onItemClick(it);
                      }}
                      className={cn(
                        "truncate rounded border px-0.5 py-px text-left text-[10px] leading-tight transition-colors sm:text-[11px]",
                        it.source === "ADMIN"
                          ? "border-violet-400/60 bg-violet-100/90 text-violet-950 hover:bg-violet-200/90 dark:border-violet-700/60 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-900/60"
                          : "border-border bg-background/80 hover:bg-muted dark:hover:bg-muted/80"
                      )}
                    >
                      {new Date(it.startsAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}{" "}
                      {it.title}
                    </button>
                  ))}
                  {more > 0 ? (
                    <button
                      type="button"
                      className="text-left text-[10px] font-medium text-primary hover:underline sm:text-[11px]"
                      onClick={() => onDayBackgroundClick(iso)}
                    >
                      +{more}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export type AgendaWeekViewProps = {
  weekMonday: Date;
  locale: string;
  holidays: WorkCalendarHolidayRecord[];
  summerIsoSet: ReadonlySet<string>;
  vacationIsoSet: ReadonlySet<string>;
  itemsByDay: Map<string, WorkerAgendaItemRecord[]>;
  kindLabel: (k: WorkCalendarHolidayKind) => string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onDayHeaderClick: (iso: string) => void;
  onItemClick: (item: WorkerAgendaItemRecord) => void;
  prevWeekLabel: string;
  nextWeekLabel: string;
  weekRangeTitle: string;
  /** Lleva la vista a la semana que contiene el día de hoy. */
  onGoToTodayWeek: () => void;
  goToTodayWeekLabel: string;
  /** Texto breve en la cabecera del día de hoy (p. ej. «Hoy»). */
  todayHeaderLabel: string;
};

export function AgendaWeekView({
  weekMonday,
  locale,
  holidays,
  summerIsoSet,
  vacationIsoSet,
  itemsByDay,
  kindLabel,
  onPrevWeek,
  onNextWeek,
  onDayHeaderClick,
  onItemClick,
  prevWeekLabel,
  nextWeekLabel,
  weekRangeTitle,
  onGoToTodayWeek,
  goToTodayWeekLabel,
  todayHeaderLabel,
}: AgendaWeekViewProps) {
  const byDate = useMemo(() => {
    const m = new Map<string, WorkCalendarHolidayRecord>();
    for (const h of holidays) {
      m.set(isoDateOnlyFromDb(h.holidayDate), h);
    }
    return m;
  }, [holidays]);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekMonday, i));
  }, [weekMonday]);

  const todayIso = useMemo(() => dateToLocalYmd(new Date()), []);

  const isViewingCurrentWeek = useMemo(() => {
    const mon = dateToLocalYmd(weekMonday);
    const sun = dateToLocalYmd(addDays(weekMonday, 6));
    return todayIso >= mon && todayIso <= sun;
  }, [weekMonday, todayIso]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-between">
          <Button type="button" variant="outline" size="icon" onClick={onPrevWeek} aria-label={prevWeekLabel}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[14rem] text-center text-base font-semibold capitalize">{weekRangeTitle}</span>
          <Button type="button" variant="outline" size="icon" onClick={onNextWeek} aria-label={nextWeekLabel}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex justify-center">
          <Button
            type="button"
            variant={isViewingCurrentWeek ? "outline" : "secondary"}
            size="sm"
            className="gap-1.5"
            disabled={isViewingCurrentWeek}
            onClick={onGoToTodayWeek}
            aria-label={goToTodayWeekLabel}
          >
            {goToTodayWeekLabel}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
        {days.map((d) => {
          const iso = dateToLocalYmd(d);
          const h = byDate.get(iso);
          const cls = cellClass(iso, h, weekendClass, monThuClass, sevenHourClass, summerIsoSet);
          const isVac = vacationIsoSet.has(iso);
          const isToday = iso === todayIso;
          const items = itemsByDay.get(iso) ?? [];
          const header = d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
          return (
            <div
              key={iso}
              className={cn(
                "flex min-h-[12rem] flex-col rounded-lg border bg-card shadow-sm transition-shadow",
                cls,
                isVac && vacationRingClass,
                isToday &&
                  "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-md z-[1] bg-primary/[0.06] dark:bg-primary/10"
              )}
            >
              <button
                type="button"
                className={cn(
                  "border-b px-2 py-2 text-left text-sm font-semibold hover:bg-muted/50",
                  isToday && "bg-primary/10 font-bold text-primary dark:bg-primary/20"
                )}
                onClick={() => onDayHeaderClick(iso)}
              >
                <span className="flex flex-wrap items-center gap-1.5 capitalize">
                  {header}
                  {isToday ? (
                    <span className="rounded-full bg-primary px-1.5 py-px text-[10px] font-semibold text-primary-foreground">
                      {todayHeaderLabel}
                    </span>
                  ) : null}
                </span>
                {h ? (
                  <span className="mt-0.5 block text-xs font-normal opacity-90">{kindLabel(h.holidayKind)}</span>
                ) : null}
              </button>
              <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">—</p>
                ) : (
                  items.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => onItemClick(it)}
                      className={cn(
                        "rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
                        it.source === "ADMIN"
                          ? "border-violet-400/60 bg-violet-100/90 text-violet-950 dark:border-violet-700/60 dark:bg-violet-950/50 dark:text-violet-100"
                          : "border-border bg-background hover:bg-muted"
                      )}
                    >
                      <span className="font-medium">
                        {new Date(it.startsAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="ml-1">{it.title}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
