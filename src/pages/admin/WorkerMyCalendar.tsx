import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompanyWorkers } from "@/hooks/useCompanyWorkers";
import { useWorkCalendarHolidays } from "@/hooks/useWorkCalendarHolidays";
import { useWorkCalendarSummerDays } from "@/hooks/useWorkCalendarSummerDays";
import { useWorkCalendarSites } from "@/hooks/useWorkCalendarSites";
import { useWorkerVacationDays } from "@/hooks/useWorkerVacationDays";
import { useWorkerVacationChangeHistory } from "@/hooks/useWorkerVacationChangeRequests";
import { WorkCalendarYearGrid } from "@/components/admin/WorkCalendarYearGrid";
import { expandSummerRangesToWeekdayIsoSet } from "@/lib/workCalendarSummerRange";
import { isWeekendIso } from "@/lib/calendarIso";
import { isoDateOnlyFromDb } from "@/lib/isoDate";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/hooks/use-toast";
import { submitWorkerVacationChangeRequest } from "@/api/workerVacationChangeRequestsApi";
import type { WorkCalendarHolidayKind } from "@/types/workCalendars";
import { getErrorMessage } from "@/lib/errorMessage";

const WorkerMyCalendar = () => {
  const { t, language } = useLanguage();
  const { user } = useAdminAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [workerMessage, setWorkerMessage] = useState("");
  const [draftDates, setDraftDates] = useState<string[]>([]);
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;

  const { data: workers = [], isLoading: loadingWorkers } = useCompanyWorkers();
  const { data: sites = [] } = useWorkCalendarSites();
  const workerId = user?.companyWorkerId ?? null;
  const worker = useMemo(
    () => (workerId ? workers.find((w) => w.id === workerId) : undefined),
    [workers, workerId]
  );
  const siteName = useMemo(() => {
    if (!worker) return "";
    return sites.find((s) => s.id === worker.workCalendarSiteId)?.name ?? "";
  }, [sites, worker]);

  const {
    data: holidays = [],
    isLoading: holidaysLoading,
    isError: holidaysError,
    error: holidaysErr,
  } = useWorkCalendarHolidays(year);
  const {
    data: summerDays = [],
    isLoading: summerLoading,
    isError: summerError,
    error: summerErr,
  } = useWorkCalendarSummerDays(year);
  const {
    data: vacationDates = [],
    isLoading: vacationLoading,
    isError: vacationError,
    error: vacationErr,
  } = useWorkerVacationDays(workerId, year);
  const { data: vacationRequests = [] } = useWorkerVacationChangeHistory(workerId);
  const pendingRequestForYear = useMemo(
    () =>
      vacationRequests.find((r) => r.status === "PENDING" && r.calendarYear === year),
    [vacationRequests, year]
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
      siteSummer.map((r) => ({
        dateStart: r.dateStart,
        dateEnd: r.dateEnd,
        label: r.label,
      }))
    );
    return { summerIsoSet: isoSet, summerLabelByIso: labelByIso };
  }, [summerDays, worker]);

  const holidayDateSet = useMemo(() => {
    const s = new Set<string>();
    for (const h of siteHolidays) {
      s.add(isoDateOnlyFromDb(h.holidayDate));
    }
    return s;
  }, [siteHolidays]);

  useEffect(() => {
    if (pendingRequestForYear) {
      setDraftDates(pendingRequestForYear.proposedDates);
      setWorkerMessage(pendingRequestForYear.workerMessage || "");
      return;
    }
    setDraftDates(vacationDates);
    setWorkerMessage("");
  }, [vacationDates, pendingRequestForYear]);

  const vacationIsoSet = useMemo(() => new Set(draftDates), [draftDates]);
  const approvedIsoSet = useMemo(() => new Set(vacationDates), [vacationDates]);
  const approvedPastIsoSet = useMemo(
    () => new Set(vacationDates.filter((d) => d < todayIso)),
    [vacationDates, todayIso]
  );
  const usedCount = vacationIsoSet.size;
  const maxDays = worker?.vacationDays ?? 0;
  const remaining = Math.max(0, maxDays - usedCount);
  const hasDraftChanges =
    draftDates.length !== vacationDates.length ||
    draftDates.some((d, idx) => d !== vacationDates[idx]);

  const canVacationClick = (iso: string) => {
    if (iso < todayIso) return false;
    if (vacationIsoSet.has(iso)) return true;
    if (usedCount >= maxDays) return false;
    if (isWeekendIso(iso)) return false;
    if (holidayDateSet.has(iso)) return false;
    return true;
  };

  const submitMutation = useMutation({
    mutationFn: () =>
      submitWorkerVacationChangeRequest({
        calendarYear: year,
        proposedDates: draftDates,
        workerMessage,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workerVacationChangeRequests });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.workerVacationChangeRequestsFor(workerId ?? ""),
      });
      toast({ title: t("admin.workerMyCalendar.toast_request_sent") });
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: getErrorMessage(e),
        variant: "destructive",
      });
    },
  });

  const dateLocale = language === "en" ? "en-GB" : language === "ca" ? "ca-ES" : "es-ES";
  const kindLabel = (k: WorkCalendarHolidayKind) => t(`admin.workCalendars.kind_${k}`);
  const vacationDayCanClick = (iso: string) =>
    !submitMutation.isPending && !pendingRequestForYear && canVacationClick(iso);

  const loadError = holidaysError || summerError || vacationError;
  const loadErrorDetail = holidaysErr ?? summerErr ?? vacationErr;

  if (!user) return null;

  if (!workerId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("admin.workerMyCalendar.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("admin.workerProfile.no_worker_link")}</p>
      </div>
    );
  }

  if (loadingWorkers || !worker) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        {t("admin.common.loading")}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm space-y-2 max-w-2xl">
        <p className="font-medium text-destructive">{t("admin.workerMyCalendar.load_error")}</p>
        <p className="text-muted-foreground break-words">{getErrorMessage(loadErrorDetail)}</p>
      </div>
    );
  }

  const calendarLoading = holidaysLoading || summerLoading || vacationLoading;

  const toggleDraftDate = (iso: string) => {
    if (pendingRequestForYear || submitMutation.isPending) return;
    setDraftDates((prev) => {
      if (prev.includes(iso)) return prev.filter((d) => d !== iso).sort();
      const next = [...prev, iso].sort();
      if (next.length > maxDays) {
        toast({
          title: t("admin.common.error"),
          description: t("admin.workerMyCalendar.error_limit").replace("{{max}}", String(maxDays)),
          variant: "destructive",
        });
        return prev;
      }
      if (isWeekendIso(iso) || holidayDateSet.has(iso)) {
        return prev;
      }
      return next;
    });
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarRange className="h-7 w-7 text-primary shrink-0" aria-hidden />
            {t("admin.workerMyCalendar.title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">{t("admin.workerMyCalendar.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground whitespace-nowrap" htmlFor="worker-cal-year">
              {t("admin.workCalendars.year")}
            </label>
            <Input
              id="worker-cal-year"
              type="number"
              min={2000}
              max={2100}
              className="w-24 h-9"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || currentYear)}
            />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.workerMyCalendar.summary_title")}</CardTitle>
          <CardDescription>
            {siteName
              ? `${t("admin.workerMyCalendar.summary_prefix")} ${siteName}`
              : t("admin.workerMyCalendar.summary_site_unknown")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">{t("admin.workerMyCalendar.vacation_max")}</span>{" "}
            <span className="font-semibold tabular-nums">{maxDays}</span>
          </p>
          <p>
            <span className="text-muted-foreground">{t("admin.workerMyCalendar.vacation_used")}</span>{" "}
            <span className="font-semibold tabular-nums">{usedCount}</span>
          </p>
          <p>
            <span className="text-muted-foreground">{t("admin.workerMyCalendar.vacation_approved")}</span>{" "}
            <span className="font-semibold tabular-nums">{approvedIsoSet.size}</span>
          </p>
          <p>
            <span className="text-muted-foreground">{t("admin.workerMyCalendar.vacation_requested")}</span>{" "}
            <span className="font-semibold tabular-nums">
              {pendingRequestForYear ? pendingRequestForYear.proposedDates.length : 0}
            </span>
          </p>
          <p>
            <span className="text-muted-foreground">{t("admin.workerMyCalendar.vacation_remaining")}</span>{" "}
            <span className="font-semibold tabular-nums text-primary">{remaining}</span>
          </p>
        </CardContent>
      </Card>

      {pendingRequestForYear ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("admin.workerMyCalendar.pending_title")}</CardTitle>
            <CardDescription>{t("admin.workerMyCalendar.pending_desc")}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.workerMyCalendar.grid_title")}</CardTitle>
          <CardDescription>
            {t("admin.workerMyCalendar.grid_desc")}
            {" "}
            {t("admin.workerMyCalendar.grid_past_locked")}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-6">
          {calendarLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              {t("admin.common.loading")}
            </div>
          ) : (
            <WorkCalendarYearGrid
              year={year}
              holidays={siteHolidays}
              summerIsoSet={summerIsoSet}
              summerLabelByIso={summerLabelByIso}
              locale={dateLocale}
              monthTitle={(monthIndex) =>
                new Date(year, monthIndex, 1).toLocaleDateString(dateLocale, { month: "long" })
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
              vacationPastIsoSet={approvedPastIsoSet}
              onVacationDayClick={toggleDraftDate}
              vacationDayCanClick={vacationDayCanClick}
              vacationLegendLabel={t("admin.workerMyCalendar.legend_vacation")}
              vacationTooltipLine={t("admin.workerMyCalendar.tooltip_vacation")}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.workerMyCalendar.request_title")}</CardTitle>
          <CardDescription>{t("admin.workerMyCalendar.request_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={workerMessage}
            onChange={(e) => setWorkerMessage(e.target.value)}
            rows={3}
            maxLength={1500}
            placeholder={t("admin.workerMyCalendar.request_message_ph")}
            disabled={!!pendingRequestForYear || submitMutation.isPending}
          />
          <Button
            type="button"
            className="gap-2"
            disabled={submitMutation.isPending || !!pendingRequestForYear || !hasDraftChanges}
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitMutation.isPending
              ? t("admin.workerMyCalendar.request_sending")
              : t("admin.workerMyCalendar.request_send")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkerMyCalendar;
