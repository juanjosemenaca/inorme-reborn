import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Clock3, Euro, Inbox, Loader2, MessageSquare, NotebookPen, CalendarRange } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useMyTimeClockEvents } from "@/hooks/useTimeTracking";
import { useMyUnreadBackofficeMessageCount } from "@/hooks/useBackofficeMessages";
import { useWorkerAgendaItems } from "@/hooks/useWorkerAgenda";
import { useWorkerExpenseSheets } from "@/hooks/useWorkerExpenseSheets";
import { computeSheetTotal } from "@/api/workerExpenseSheetsApi";
import { addDays, dateToLocalYmd, startOfWeekMonday } from "@/components/admin/WorkerAgendaTimeViews";
import {
  deriveTodayWorkerTimeClock,
  monthRange,
  todayIso,
} from "@/pages/admin/workerTimeClockShared";
import { cn } from "@/lib/utils";
import { BackofficeTodayDateCard } from "@/components/admin/BackofficeTodayDateCard";
import type { WorkerAgendaItemRecord } from "@/types/agenda";

function sortAgendaByTime(items: WorkerAgendaItemRecord[]): WorkerAgendaItemRecord[] {
  return [...items].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

function AgendaEntryList({
  items,
  localeTag,
  formatTime,
  t,
}: {
  items: WorkerAgendaItemRecord[];
  localeTag: string;
  formatTime: (iso: string) => string;
  t: (key: string) => string;
}) {
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li
          key={it.id}
          className={cn(
            "rounded-md border px-2 py-1.5 text-sm",
            it.source === "ADMIN" &&
              "border-violet-300/50 bg-violet-50/80 dark:border-violet-800/50 dark:bg-violet-950/25"
          )}
        >
          <p className="text-[11px] text-muted-foreground">
            {new Date(it.startsAt).toLocaleDateString(localeTag, {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
            {" · "}
            {formatTime(it.startsAt)}
          </p>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-1.5">
            <span className="font-medium leading-tight">{it.title}</span>
            {it.source === "ADMIN" ? (
              <Badge variant="secondary" className="h-5 text-[10px]">
                {t("admin.agenda.badge_admin")}
              </Badge>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function resolveWorkerVisualState(s: {
  absent: boolean;
  onBreak: boolean;
  inWork: boolean;
  hasClockOut: boolean;
}): "idle" | "working" | "break" | "finished" | "absent" {
  if (s.absent) return "absent";
  if (s.onBreak) return "break";
  if (s.inWork) return "working";
  if (s.hasClockOut) return "finished";
  return "idle";
}

export function WorkerDashboard() {
  const { t, language } = useLanguage();
  const { user } = useAdminAuth();
  const modules = user?.enabledModules ?? [];
  const hasTimeClock = modules.includes("TIME_CLOCK");
  const hasMessages = modules.includes("MESSAGES");
  const hasAgenda = modules.includes("AGENDA");
  const hasGastos = modules.includes("GASTOS");
  const companyWorkerId = user?.companyWorkerId ?? null;

  const today = new Date();
  const agendaWeekMonday = startOfWeekMonday(today);
  const isFriday = today.getDay() === 5;

  const currentWeekFromIso = dateToLocalYmd(agendaWeekMonday);
  const currentWeekToIso = dateToLocalYmd(addDays(agendaWeekMonday, 6));

  const nextWeekFromIso = dateToLocalYmd(addDays(agendaWeekMonday, 7));
  const nextWeekToIso = dateToLocalYmd(addDays(agendaWeekMonday, 13));

  const { data: rawCurrentWeek = [], isLoading: agendaLoading } = useWorkerAgendaItems(
    companyWorkerId,
    currentWeekFromIso,
    currentWeekToIso,
    hasAgenda && !!companyWorkerId
  );

  const { data: rawNextWeek = [], isLoading: nextWeekLoading } = useWorkerAgendaItems(
    companyWorkerId,
    nextWeekFromIso,
    nextWeekToIso,
    hasAgenda && !!companyWorkerId && isFriday
  );

  const currentWeekItems = useMemo(() => sortAgendaByTime(rawCurrentWeek), [rawCurrentWeek]);
  const nextWeekItems = useMemo(() => sortAgendaByTime(rawNextWeek), [rawNextWeek]);

  const month = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const { from, to } = useMemo(() => monthRange(month), [month]);

  const { data: events = [], isLoading: tcLoading, isError: tcError } = useMyTimeClockEvents(
    from,
    to,
    hasTimeClock
  );
  const { data: unreadCount = 0, isLoading: msgLoading } = useMyUnreadBackofficeMessageCount(hasMessages);

  const { data: expenseSheets = [], isLoading: expensesLoading } = useWorkerExpenseSheets(
    companyWorkerId,
    hasGastos && !!companyWorkerId
  );

  const currentMonthExpenseSheet = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    return expenseSheets.find(
      (s) => s.periodKind === "MONTH" && s.calendarYear === y && s.calendarMonth === m
    );
  }, [expenseSheets]);

  const localeTag = language === "en" ? "en-GB" : language === "ca" ? "ca-ES" : "es-ES";
  const agendaRangeLabel = useMemo(() => {
    const a = new Date(currentWeekFromIso + "T12:00:00");
    const b = new Date(currentWeekToIso + "T12:00:00");
    return `${a.toLocaleDateString(localeTag, { day: "numeric", month: "short" })} – ${b.toLocaleDateString(localeTag, { day: "numeric", month: "short", year: "numeric" })}`;
  }, [currentWeekFromIso, currentWeekToIso, localeTag]);

  const nextWeekRangeLabel = useMemo(() => {
    const a = new Date(nextWeekFromIso + "T12:00:00");
    const b = new Date(nextWeekToIso + "T12:00:00");
    return `${a.toLocaleDateString(localeTag, { day: "numeric", month: "short" })} – ${b.toLocaleDateString(localeTag, { day: "numeric", month: "short", year: "numeric" })}`;
  }, [nextWeekFromIso, nextWeekToIso, localeTag]);
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" });

  const todayEvents = useMemo(
    () => events.filter((e) => e.eventAt.slice(0, 10) === todayIso()),
    [events]
  );
  const derived = useMemo(() => deriveTodayWorkerTimeClock(todayEvents), [todayEvents]);
  const visual = resolveWorkerVisualState(derived.todayState);

  const statusLabel = useMemo(() => {
    const s = derived.todayState;
    if (s.absent) return t("admin.timeClock.state_absent");
    if (s.onBreak) return t("admin.timeClock.state_break");
    if (s.inWork) return t("admin.timeClock.state_working");
    if (s.hasClockOut) return t("admin.timeClock.state_day_finished");
    return t("admin.timeClock.state_idle");
  }, [derived.todayState, t]);

  const statusBadgeClass =
    visual === "working"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
      : visual === "break"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-300"
        : visual === "finished"
          ? "border-sky-500/40 bg-sky-500/10 text-sky-900 dark:text-sky-300"
          : visual === "absent"
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : "border-muted-foreground/30 bg-muted text-muted-foreground";

  const showMessagesCard = hasMessages && !msgLoading && unreadCount > 0;
  const showAgendaWeekCard =
    hasAgenda && !!companyWorkerId && !agendaLoading && currentWeekItems.length > 0;
  const showAgendaFridayCard =
    isFriday && hasAgenda && !!companyWorkerId && !nextWeekLoading && nextWeekItems.length > 0;
  const showAgendaSection = showAgendaWeekCard || showAgendaFridayCard;

  const expenseStatusLabel = (status: string): string => {
    if (status === "DRAFT") return t("admin.expenses.status_draft");
    if (status === "SUBMITTED") return t("admin.expenses.status_submitted");
    if (status === "APPROVED") return t("admin.expenses.status_approved");
    if (status === "REJECTED") return t("admin.expenses.status_rejected");
    return status;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold tracking-tight">{t("admin.dashboard.worker_title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("admin.dashboard.worker_intro")} <strong>{t("admin.dashboard.worker_strong")}</strong>{" "}
            {t("admin.dashboard.worker_intro_end")}
          </p>
        </div>
        <BackofficeTodayDateCard
          todayTitle={t("admin.dashboard.worker_today_title")}
          language={language}
          localeTag={localeTag}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Fichaje — solo informativo */}
        {hasTimeClock ? (
          <Card className="flex flex-col border-2 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <CardTitle className="text-base leading-tight">{t("admin.dashboard.worker_timeclock_title")}</CardTitle>
                </div>
              </div>
              <CardDescription>{t("admin.dashboard.worker_timeclock_hint")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              {tcLoading ? (
                <div className="flex items-center gap-2 py-6 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t("admin.common.loading")}
                </div>
              ) : tcError ? (
                <p className="text-sm text-destructive">{t("admin.dashboard.worker_timeclock_error")}</p>
              ) : (
                <>
                  <Badge variant="outline" className={cn("w-fit border-2 px-3 py-1.5 text-sm font-semibold", statusBadgeClass)}>
                    {statusLabel}
                  </Badge>
                  {derived.todayState.inWork && !derived.todayState.onBreak && derived.lastClockInAt ? (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{t("admin.dashboard.worker_timeclock_clock_in")}</span>{" "}
                      {formatTime(derived.lastClockInAt)}
                    </p>
                  ) : null}
                  {derived.todayState.onBreak && derived.openBreakComment ? (
                    <div className="rounded-md border bg-amber-500/5 p-3 text-sm">
                      <p className="font-medium text-amber-900 dark:text-amber-200">
                        {t("admin.dashboard.worker_timeclock_pause_reason")}
                      </p>
                      <p className="mt-1 text-muted-foreground">{derived.openBreakComment}</p>
                    </div>
                  ) : null}
                  {derived.todayState.absent && derived.absenceReasonDisplay ? (
                    <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm">
                      <p className="font-medium text-destructive">{t("admin.dashboard.worker_timeclock_absence_reason")}</p>
                      <p className="mt-1 text-muted-foreground">{derived.absenceReasonDisplay}</p>
                    </div>
                  ) : null}
                  {derived.todayState.onBreak && !derived.openBreakComment ? (
                    <p className="text-xs text-muted-foreground">{t("admin.dashboard.worker_timeclock_pause_no_comment")}</p>
                  ) : null}
                </>
              )}
              <div className="mt-auto pt-2">
                <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
                  <Link to="/admin/fichajes/fichar">{t("admin.dashboard.worker_timeclock_link")}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Gastos: acceso al parte del mes en curso */}
        {hasGastos && companyWorkerId ? (
          <Card className="flex flex-col border-2 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Euro className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                <CardTitle className="text-base">{t("admin.dashboard.worker_expenses_title")}</CardTitle>
              </div>
              <CardDescription>{t("admin.dashboard.worker_expenses_hint")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              {expensesLoading ? (
                <div className="flex items-center gap-2 py-4 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t("admin.common.loading")}
                </div>
              ) : currentMonthExpenseSheet ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-normal">
                      {expenseStatusLabel(currentMonthExpenseSheet.status)}
                    </Badge>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {computeSheetTotal(currentMonthExpenseSheet).toLocaleString(localeTag, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      €
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("admin.dashboard.worker_expenses_period_label")}:{" "}
                    {currentMonthExpenseSheet.calendarYear}-{String(currentMonthExpenseSheet.calendarMonth).padStart(2, "0")}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t("admin.dashboard.worker_expenses_empty_month")}</p>
              )}
              <div className="mt-auto pt-1">
                <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
                  <Link to="/admin/mis-gastos">{t("admin.dashboard.worker_expenses_link")}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Mensajes sin leer: solo si hay alguno pendiente */}
        {showMessagesCard ? (
          <Card className="flex flex-col border-2 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Inbox className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                <CardTitle className="text-base">{t("admin.dashboard.worker_messages_title")}</CardTitle>
              </div>
              <CardDescription>{t("admin.dashboard.worker_messages_hint")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-4">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold tabular-nums tracking-tight text-foreground">{unreadCount}</span>
                <span className="text-sm text-muted-foreground">{t("admin.dashboard.worker_messages_unread_label")}</span>
              </div>
              <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
                <Link to="/admin/mensajes" className="inline-flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" aria-hidden />
                  {t("admin.dashboard.worker_messages_link")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {showAgendaSection ? (
          <div className="flex flex-col gap-3">
            {showAgendaWeekCard ? (
              <Card className="flex flex-col overflow-hidden border-2 shadow-sm xl:aspect-square xl:min-h-0">
                <CardHeader className="pb-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <NotebookPen className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                    <CardTitle className="text-base">{t("admin.dashboard.worker_agenda_title")}</CardTitle>
                  </div>
                  <CardDescription>{t("admin.dashboard.worker_agenda_hint")}</CardDescription>
                  <p className="text-xs text-muted-foreground pt-0.5">{agendaRangeLabel}</p>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
                  <div className="flex min-h-0 flex-1 overflow-y-auto pr-1">
                    <AgendaEntryList items={currentWeekItems} localeTag={localeTag} formatTime={formatTime} t={t} />
                  </div>
                  <div className="mt-auto shrink-0 pt-1">
                    <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
                      <Link to="/admin/mi-agenda">{t("admin.dashboard.worker_agenda_link")}</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {showAgendaFridayCard ? (
              <Card className="flex flex-col border-2 border-amber-400/50 bg-amber-50/60 shadow-sm dark:border-amber-700/50 dark:bg-amber-950/25 sm:max-w-md">
                <CardHeader className="space-y-1 pb-2 pt-3">
                  <div className="flex items-center gap-2">
                    <CalendarRange className="h-4 w-4 shrink-0 text-amber-800 dark:text-amber-200" aria-hidden />
                    <CardTitle className="text-sm font-semibold leading-tight">
                      {t("admin.dashboard.worker_agenda_friday_preview_title")}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs">{t("admin.dashboard.worker_agenda_friday_preview_hint")}</CardDescription>
                  <p className="text-[11px] text-muted-foreground">{nextWeekRangeLabel}</p>
                </CardHeader>
                <CardContent className="space-y-2 pb-3 pt-0">
                  <div className="max-h-48 overflow-y-auto pr-1">
                    <AgendaEntryList items={nextWeekItems} localeTag={localeTag} formatTime={formatTime} t={t} />
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
