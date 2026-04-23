import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompanyWorkers } from "@/hooks/useCompanyWorkers";
import { useWorkCalendarHolidays } from "@/hooks/useWorkCalendarHolidays";
import { useWorkCalendarSummerDays } from "@/hooks/useWorkCalendarSummerDays";
import { useWorkCalendarSites } from "@/hooks/useWorkCalendarSites";
import { useWorkerVacationDays } from "@/hooks/useWorkerVacationDays";
import { useWorkerAgendaItems } from "@/hooks/useWorkerAgenda";
import { WorkCalendarYearGrid } from "@/components/admin/WorkCalendarYearGrid";
import {
  AgendaMonthView,
  AgendaWeekView,
  addDays,
  dateToLocalYmd,
  groupAgendaItemsByLocalDay,
  startOfWeekMonday,
} from "@/components/admin/WorkerAgendaTimeViews";
import { expandSummerRangesToWeekdayIsoSet } from "@/lib/workCalendarSummerRange";
import { useToast } from "@/hooks/use-toast";
import {
  completeWorkerAgendaTodo,
  createWorkerAgendaItem,
  deleteWorkerAgendaItem,
  updateWorkerAgendaItem,
} from "@/api/workerAgendaApi";
import { queryKeys } from "@/lib/queryKeys";
import type { WorkCalendarHolidayKind } from "@/types/workCalendars";
import type { WorkerAgendaItemRecord, WorkerAgendaItemType } from "@/types/agenda";
import { cn } from "@/lib/utils";
import { isoDateOnlyFromDb } from "@/lib/isoDate";
import { isWeekendIso } from "@/lib/calendarIso";

function toLocalYmd(isoUtc: string): string {
  const d = new Date(isoUtc);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isFridayIso(iso: string): boolean {
  return new Date(iso + "T12:00:00").getDay() === 5;
}

const WORKER_TYPES: WorkerAgendaItemType[] = ["reminder", "event", "meeting", "other"];

function buildAgendaCountByIso(items: WorkerAgendaItemRecord[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = toLocalYmd(it.startsAt);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

type AgendaViewMode = "year" | "month" | "week";

const WorkerAgenda = () => {
  const { t, language } = useLanguage();
  const { user } = useAdminAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const workerId = user?.companyWorkerId ?? null;
  const now = new Date();
  const defaultYear = now.getFullYear();
  const [viewMode, setViewMode] = useState<AgendaViewMode>("month");
  const [editYear, setEditYear] = useState(defaultYear);
  const [monthCursor, setMonthCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [weekMonday, setWeekMonday] = useState(() => startOfWeekMonday(now));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WorkerAgendaItemRecord | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("");
  const [formType, setFormType] = useState<WorkerAgendaItemType>("event");
  const [detailItem, setDetailItem] = useState<WorkerAgendaItemRecord | null>(null);
  const [summaryIso, setSummaryIso] = useState<string | null>(null);

  const { data: workers = [] } = useCompanyWorkers();
  const { data: sites = [] } = useWorkCalendarSites();
  const worker = useMemo(
    () => (workerId ? workers.find((w) => w.id === workerId) : undefined),
    [workers, workerId]
  );
  const siteName = worker ? sites.find((s) => s.id === worker.workCalendarSiteId)?.name ?? "" : "";

  const holidayYears = useMemo(() => {
    if (viewMode === "year") return { a: editYear, b: editYear };
    if (viewMode === "month") return { a: monthCursor.getFullYear(), b: monthCursor.getFullYear() };
    const end = addDays(weekMonday, 6);
    const a = weekMonday.getFullYear();
    const b = end.getFullYear();
    return { a, b: a === b ? a : b };
  }, [viewMode, editYear, monthCursor, weekMonday]);

  const { data: holidaysA = [], isLoading: hLoadA } = useWorkCalendarHolidays(holidayYears.a);
  const { data: holidaysB = [], isLoading: hLoadB } = useWorkCalendarHolidays(holidayYears.b);
  const holidays = useMemo(() => {
    if (holidayYears.a === holidayYears.b) return holidaysA;
    return [...holidaysA, ...holidaysB];
  }, [holidayYears, holidaysA, holidaysB]);

  const { data: summerA = [], isLoading: sLoadA } = useWorkCalendarSummerDays(holidayYears.a);
  const { data: summerB = [], isLoading: sLoadB } = useWorkCalendarSummerDays(holidayYears.b);
  const summerDays = useMemo(() => {
    if (holidayYears.a === holidayYears.b) return summerA;
    return [...summerA, ...summerB];
  }, [holidayYears, summerA, summerB]);

  const { data: vacA = [], isLoading: vLoadA } = useWorkerVacationDays(workerId, holidayYears.a);
  const { data: vacB = [], isLoading: vLoadB } = useWorkerVacationDays(workerId, holidayYears.b);
  const vacationDates = useMemo(() => {
    const da = vacA.map((e) => e.date);
    const db = vacB.map((e) => e.date);
    if (holidayYears.a === holidayYears.b) return da;
    return [...new Set([...da, ...db])];
  }, [holidayYears, vacA, vacB]);

  const agendaRange = useMemo(() => {
    if (viewMode === "year") {
      return { fromIso: `${editYear}-01-01`, toIso: `${editYear}-12-31` };
    }
    if (viewMode === "month") {
      const y = monthCursor.getFullYear();
      const m = monthCursor.getMonth();
      const last = new Date(y, m + 1, 0);
      return {
        fromIso: `${y}-${String(m + 1).padStart(2, "0")}-01`,
        toIso: `${y}-${String(m + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`,
      };
    }
    const end = addDays(weekMonday, 6);
    return { fromIso: dateToLocalYmd(weekMonday), toIso: dateToLocalYmd(end) };
  }, [viewMode, editYear, monthCursor, weekMonday]);

  const { data: agendaItems = [], isLoading: aLoad } = useWorkerAgendaItems(
    workerId,
    agendaRange.fromIso,
    agendaRange.toIso,
    !!workerId
  );

  const siteHolidays = useMemo(() => {
    if (!worker) return [];
    return holidays.filter((h) => h.siteId === worker.workCalendarSiteId);
  }, [holidays, worker]);

  const { summerIsoSet, summerLabelByIso } = useMemo(() => {
    if (!worker) {
      return {
        summerIsoSet: new Set<string>() as ReadonlySet<string>,
        summerLabelByIso: new Map<string, string>(),
      };
    }
    const siteSummer = summerDays.filter((s) => s.siteId === worker.workCalendarSiteId);
    const { isoSet, labelByIso } = expandSummerRangesToWeekdayIsoSet(
      siteSummer.map((r) => ({ dateStart: r.dateStart, dateEnd: r.dateEnd, label: r.label }))
    );
    return { summerIsoSet: isoSet as ReadonlySet<string>, summerLabelByIso: labelByIso };
  }, [summerDays, worker]);

  const vacationIsoSet = useMemo(() => new Set(vacationDates), [vacationDates]);
  const agendaCountByIso = useMemo(() => buildAgendaCountByIso(agendaItems), [agendaItems]);
  const itemsByDay = useMemo(() => groupAgendaItemsByLocalDay(agendaItems), [agendaItems]);

  const dateLocale = language === "en" ? "en-GB" : language === "ca" ? "ca-ES" : "es-ES";
  const kindLabel = (k: WorkCalendarHolidayKind) => t(`admin.workCalendars.kind_${k}`);

  const weekDayLabels = useMemo(() => {
    const refMonday = new Date(editYear, 0, 5);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(refMonday);
      d.setDate(refMonday.getDate() + i);
      return d.toLocaleDateString(dateLocale, { weekday: "narrow" });
    });
  }, [editYear, dateLocale]);

  const weekRangeTitle = useMemo(() => {
    const end = addDays(weekMonday, 6);
    const a = weekMonday.toLocaleDateString(dateLocale, { day: "numeric", month: "short" });
    const b = end.toLocaleDateString(dateLocale, { day: "numeric", month: "short", year: "numeric" });
    return `${a} – ${b}`;
  }, [weekMonday, dateLocale]);

  const holidayByIso = useMemo(() => {
    const m = new Map<string, (typeof siteHolidays)[0]>();
    for (const h of siteHolidays) {
      m.set(isoDateOnlyFromDb(h.holidayDate), h);
    }
    return m;
  }, [siteHolidays]);

  const summaryDayItems = summaryIso ? itemsByDay.get(summaryIso) ?? [] : [];
  const summaryHoliday = summaryIso ? holidayByIso.get(summaryIso) : undefined;
  const summaryVacation = summaryIso ? vacationIsoSet.has(summaryIso) : false;
  const summaryPrettyDate = summaryIso
    ? new Date(summaryIso + "T12:00:00").toLocaleDateString(dateLocale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const calendarLoading = hLoadA || hLoadB || sLoadA || sLoadB || vLoadA || vLoadB || aLoad;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!workerId) throw new Error("No worker");
      const [hh, mm] = formTime.split(":").map(Number);
      const start = new Date(formDate + "T12:00:00");
      start.setHours(hh, mm, 0, 0);
      let endsAt: string | null = null;
      if (formEndTime.trim()) {
        const [eh, em] = formEndTime.split(":").map(Number);
        const end = new Date(formDate + "T12:00:00");
        end.setHours(eh, em, 0, 0);
        endsAt = end.toISOString();
      }
      if (editing) {
        return updateWorkerAgendaItem(editing.id, {
          title: formTitle,
          description: formDesc || null,
          startsAt: start.toISOString(),
          endsAt,
          itemType: formType,
        });
      }
      return createWorkerAgendaItem({
        companyWorkerId: workerId,
        title: formTitle,
        description: formDesc || null,
        startsAt: start.toISOString(),
        endsAt,
        itemType: formType,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workerAgendaItems"] });
      toast({ title: t("admin.agenda.toast_saved") });
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWorkerAgendaItem(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workerAgendaItems"] });
      toast({ title: t("admin.agenda.toast_deleted") });
      setDetailItem(null);
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

  const completeTodoMutation = useMutation({
    mutationFn: (id: string) => completeWorkerAgendaTodo(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workerAgendaItems"] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessages });
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessageUnreadCount });
      toast({ title: t("admin.agenda.toast_todo_done") });
      setDetailItem(null);
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

  const openNew = () => {
    setEditing(null);
    setFormTitle("");
    setFormDesc("");
    const tday = new Date();
    setFormDate(
      `${tday.getFullYear()}-${String(tday.getMonth() + 1).padStart(2, "0")}-${String(tday.getDate()).padStart(2, "0")}`
    );
    setFormTime("09:00");
    setFormEndTime("");
    setFormType("event");
    setDialogOpen(true);
  };

  const openEdit = (item: WorkerAgendaItemRecord) => {
    if (item.source === "ADMIN") return;
    setEditing(item);
    setFormTitle(item.title);
    setFormDesc(item.description ?? "");
    setFormDate(toLocalYmd(item.startsAt));
    const s = new Date(item.startsAt);
    setFormTime(`${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`);
    if (item.endsAt) {
      const e = new Date(item.endsAt);
      setFormEndTime(`${String(e.getHours()).padStart(2, "0")}:${String(e.getMinutes()).padStart(2, "0")}`);
    } else setFormEndTime("");
    setFormType(item.itemType === "admin_note" ? "event" : item.itemType);
    setDialogOpen(true);
  };

  const goPrevMonth = () => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const goNextMonth = () => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goPrevWeek = () => setWeekMonday((d) => addDays(d, -7));
  const goNextWeek = () => setWeekMonday((d) => addDays(d, 7));
  const goToThisWeek = () => setWeekMonday(startOfWeekMonday(new Date()));

  const onPickView = (mode: AgendaViewMode) => {
    setViewMode(mode);
    if (mode === "month") {
      setMonthCursor((d) => new Date(editYear, d.getMonth(), 1));
    }
    if (mode === "week") {
      setWeekMonday(startOfWeekMonday(new Date()));
    }
  };

  if (!workerId) {
    return <p className="text-sm text-muted-foreground">{t("admin.agenda.no_worker_profile")}</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <CalendarDays className="h-7 w-7 text-primary" aria-hidden />
          {t("admin.agenda.worker_title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.agenda.worker_subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.agenda.summary_title")}</CardTitle>
          <CardDescription>
            {siteName
              ? `${t("admin.agenda.summary_calendar")}: ${siteName}`
              : t("admin.agenda.summary_site_unknown")}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
          {(
            [
              ["year", t("admin.agenda.view_year")],
              ["month", t("admin.agenda.view_month")],
              ["week", t("admin.agenda.view_week")],
            ] as const
          ).map(([mode, label]) => (
            <Button
              key={mode}
              type="button"
              size="sm"
              variant={viewMode === mode ? "default" : "ghost"}
              className="h-8"
              onClick={() => onPickView(mode)}
            >
              {label}
            </Button>
          ))}
        </div>
        {viewMode === "year" ? (
          <>
            <Label className="text-sm">{t("admin.agenda.year")}</Label>
            <Input
              type="number"
              className="w-28"
              value={editYear}
              onChange={(e) => setEditYear(Number(e.target.value) || defaultYear)}
              min={2020}
              max={2040}
            />
          </>
        ) : null}
        <Button type="button" className="gap-2" onClick={openNew}>
          <Plus className="h-4 w-4" />
          {t("admin.agenda.add_entry")}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.agenda.grid_title")}</CardTitle>
          <CardDescription>{t("admin.agenda.grid_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="pb-6">
          {calendarLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              {t("admin.common.loading")}
            </div>
          ) : viewMode === "year" ? (
            <WorkCalendarYearGrid
              year={editYear}
              holidays={siteHolidays}
              summerIsoSet={summerIsoSet}
              summerLabelByIso={summerLabelByIso}
              locale={dateLocale}
              monthTitle={(monthIndex) =>
                new Date(editYear, monthIndex, 1).toLocaleDateString(dateLocale, { month: "long" })
              }
              kindLabel={kindLabel}
              legendCaption={t("admin.workCalendars.legend_caption")}
              legendMonThu={t("admin.workCalendars.legend_mon_thu")}
              legendSevenHour={t("admin.workCalendars.legend_seven_hour")}
              legendWeekend={t("admin.workCalendars.legend_weekend")}
              legendNational={t("admin.workCalendars.legend_color_nacional")}
              legendRegional={t("admin.workCalendars.legend_color_autonomico")}
              legendLocal={t("admin.workCalendars.legend_color_local")}
              tooltipFriday7h={t("admin.workCalendars.tooltip_friday_7h")}
              tooltipSummer7h={t("admin.workCalendars.tooltip_summer_7h")}
              vacationIsoSet={vacationIsoSet}
              vacationLegendLabel={t("admin.workerMyCalendar.legend_vacation")}
              vacationTooltipLine={t("admin.workerMyCalendar.tooltip_vacation")}
              agendaCountByIso={agendaCountByIso}
              agendaLegendLabel={t("admin.agenda.legend_agenda")}
            />
          ) : viewMode === "month" ? (
            <AgendaMonthView
              displayMonth={monthCursor}
              locale={dateLocale}
              holidays={siteHolidays}
              summerIsoSet={summerIsoSet}
              vacationIsoSet={vacationIsoSet}
              itemsByDay={itemsByDay}
              weekDayLabels={weekDayLabels}
              onPrevMonth={goPrevMonth}
              onNextMonth={goNextMonth}
              onDayBackgroundClick={(iso) => setSummaryIso(iso)}
              onItemClick={(item) => setDetailItem(item)}
              prevMonthLabel={t("admin.agenda.prev_month")}
              nextMonthLabel={t("admin.agenda.next_month")}
            />
          ) : (
            <AgendaWeekView
              weekMonday={weekMonday}
              locale={dateLocale}
              holidays={siteHolidays}
              summerIsoSet={summerIsoSet}
              vacationIsoSet={vacationIsoSet}
              itemsByDay={itemsByDay}
              kindLabel={kindLabel}
              onPrevWeek={goPrevWeek}
              onNextWeek={goNextWeek}
              onDayHeaderClick={(iso) => setSummaryIso(iso)}
              onItemClick={(item) => setDetailItem(item)}
              prevWeekLabel={t("admin.agenda.prev_week")}
              nextWeekLabel={t("admin.agenda.next_week")}
              weekRangeTitle={weekRangeTitle}
              onGoToTodayWeek={goToThisWeek}
              goToTodayWeekLabel={t("admin.agenda.week_back_to_today")}
              todayHeaderLabel={t("admin.agenda.week_today_badge")}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.agenda.list_title")}</CardTitle>
          <CardDescription>{t("admin.agenda.list_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {agendaItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("admin.agenda.list_empty")}</p>
          ) : (
            <ul className="space-y-2">
              {agendaItems.map((it) => (
                <li
                  key={it.id}
                  className={cn(
                    "flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3",
                    it.source === "ADMIN" && "border-violet-300/60 bg-violet-50/80 dark:bg-violet-950/20"
                  )}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className={cn(
                          "text-left font-medium hover:underline",
                          it.itemType === "todo" && it.completedAt && "line-through text-muted-foreground"
                        )}
                        onClick={() => setDetailItem(it)}
                      >
                        {it.title}
                      </button>
                      <Badge variant="outline" className="text-[10px]">
                        {t(`admin.agenda.type_${it.itemType}`)}
                      </Badge>
                      {it.itemType === "todo" && it.completedAt ? (
                        <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">
                          {t("admin.agenda.todo_done_badge")}
                        </Badge>
                      ) : null}
                      {it.source === "ADMIN" ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {t("admin.agenda.badge_admin")}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(it.startsAt).toLocaleString(dateLocale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      {it.endsAt
                        ? ` – ${new Date(it.endsAt).toLocaleTimeString(dateLocale, { timeStyle: "short" })}`
                        : null}
                    </p>
                    {it.description ? (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{it.description}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                    {it.source === "ADMIN" &&
                    it.itemType === "todo" &&
                    !it.completedAt ? (
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1"
                        onClick={() => completeTodoMutation.mutate(it.id)}
                        disabled={completeTodoMutation.isPending}
                      >
                        {completeTodoMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        {t("admin.agenda.todo_mark_done")}
                      </Button>
                    ) : null}
                    {it.source === "WORKER" ? (
                      <>
                        <Button type="button" size="icon" variant="ghost" onClick={() => openEdit(it)} aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => deleteMutation.mutate(it.id)}
                          disabled={deleteMutation.isPending}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detailItem} onOpenChange={(open) => !open && setDetailItem(null)}>
        <DialogContent className="max-w-md">
          {detailItem ? (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8">{detailItem.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-1">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{t(`admin.agenda.type_${detailItem.itemType}`)}</Badge>
                  {detailItem.source === "ADMIN" ? (
                    <Badge variant="secondary">{t("admin.agenda.badge_admin")}</Badge>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  {new Date(detailItem.startsAt).toLocaleString(dateLocale, {
                    dateStyle: "full",
                    timeStyle: "short",
                  })}
                  {detailItem.endsAt
                    ? ` – ${new Date(detailItem.endsAt).toLocaleTimeString(dateLocale, { timeStyle: "short" })}`
                    : null}
                </p>
                {detailItem.description ? (
                  <p className="text-sm whitespace-pre-wrap">{detailItem.description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("admin.agenda.detail_no_description")}</p>
                )}
                {detailItem.itemType === "todo" && detailItem.completedAt ? (
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    {t("admin.agenda.todo_completed_at").replace(
                      "{{date}}",
                      new Date(detailItem.completedAt).toLocaleString(dateLocale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    )}
                  </p>
                ) : null}
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                {detailItem.source === "WORKER" ? (
                  <>
                    <Button type="button" variant="outline" onClick={() => setDetailItem(null)}>
                      {t("admin.common.cancel")}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => deleteMutation.mutate(detailItem.id)}
                      disabled={deleteMutation.isPending}
                    >
                      {t("admin.common.delete")}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        const it = detailItem;
                        setDetailItem(null);
                        openEdit(it);
                      }}
                    >
                      {t("admin.common.edit")}
                    </Button>
                  </>
                ) : (
                  <>
                    {detailItem.itemType === "todo" && !detailItem.completedAt ? (
                      <Button
                        type="button"
                        className="gap-1"
                        onClick={() => completeTodoMutation.mutate(detailItem.id)}
                        disabled={completeTodoMutation.isPending}
                      >
                        {completeTodoMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        {t("admin.agenda.todo_mark_done")}
                      </Button>
                    ) : null}
                    <Button type="button" variant="secondary" onClick={() => setDetailItem(null)}>
                      {t("admin.agenda.detail_close")}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!summaryIso} onOpenChange={(open) => !open && setSummaryIso(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">{summaryPrettyDate}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {summaryHoliday ? (
              <div className="rounded-md border bg-muted/40 px-3 py-2">
                <p className="font-medium">{t("admin.agenda.day_summary_holiday")}</p>
                <p className="text-muted-foreground">
                  {kindLabel(summaryHoliday.holidayKind)}
                  {summaryHoliday.label ? ` — ${summaryHoliday.label}` : null}
                </p>
              </div>
            ) : null}
            {summaryIso && !isWeekendIso(summaryIso) && !summaryHoliday ? (
              <p className="text-muted-foreground">
                {isFridayIso(summaryIso) || summerIsoSet.has(summaryIso)
                  ? t("admin.workCalendars.legend_seven_hour")
                  : t("admin.workCalendars.legend_mon_thu")}
                {summerLabelByIso.get(summaryIso) ? ` · ${summerLabelByIso.get(summaryIso)}` : null}
              </p>
            ) : null}
            {summaryIso && isWeekendIso(summaryIso) && !summaryHoliday ? (
              <p className="text-muted-foreground">{t("admin.workCalendars.legend_weekend")}</p>
            ) : null}
            {summaryVacation ? (
              <div className="rounded-md border border-sky-300/60 bg-sky-50/90 px-3 py-2 dark:bg-sky-950/30">
                {t("admin.workerMyCalendar.legend_vacation")}
              </div>
            ) : null}
            <div>
              <p className="mb-2 font-medium">{t("admin.agenda.day_summary_agenda_section")}</p>
              {summaryDayItems.length === 0 ? (
                <p className="text-muted-foreground">{t("admin.agenda.day_summary_no_items")}</p>
              ) : (
                <ul className="space-y-2">
                  {summaryDayItems.map((it) => (
                    <li key={it.id}>
                      <button
                        type="button"
                        className="w-full rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted"
                        onClick={() => {
                          setSummaryIso(null);
                          setDetailItem(it);
                        }}
                      >
                        <span className="font-medium">{it.title}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {new Date(it.startsAt).toLocaleTimeString(dateLocale, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setSummaryIso(null)}>
              {t("admin.agenda.detail_close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t("admin.agenda.dialog_edit") : t("admin.agenda.dialog_new")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>{t("admin.agenda.field_title")}</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} maxLength={500} />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.agenda.field_type")}</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as WorkerAgendaItemType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKER_TYPES.map((k) => (
                    <SelectItem key={k} value={k}>
                      {t(`admin.agenda.type_${k}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>{t("admin.agenda.field_date")}</Label>
                <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.agenda.field_time")}</Label>
                <Input type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("admin.agenda.field_end_time")}</Label>
              <Input type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.agenda.field_description")}</Label>
              <Textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {t("admin.common.cancel")}
            </Button>
            <Button
              type="button"
              disabled={!formTitle.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("admin.agenda.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkerAgenda;
