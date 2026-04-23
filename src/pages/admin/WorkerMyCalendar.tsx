import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  normalizeVacationEntries,
  vacationEntriesEqual,
} from "@/lib/vacationProposedJson";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/hooks/use-toast";
import { submitWorkerVacationChangeRequest } from "@/api/workerVacationChangeRequestsApi";
import {
  fetchApprovedCarryoverAllowance,
  getUnusedStandardDaysInYear,
  submitCarryoverRequest,
} from "@/api/workerVacationCarryoverRequestsApi";
import type { WorkCalendarHolidayKind } from "@/types/workCalendars";
import { getErrorMessage } from "@/lib/errorMessage";
import type { VacationDayEntry } from "@/types/vacationDays";

function countStandardAndCarry(entries: VacationDayEntry[], calendarYear: number) {
  const src = calendarYear - 1;
  let standardN = 0;
  let carryN = 0;
  for (const e of entries) {
    if (e.carryoverFromYear == null) standardN += 1;
    else if (e.carryoverFromYear === src) carryN += 1;
  }
  return { standardN, carryN };
}

const WorkerMyCalendar = () => {
  const { t, language } = useLanguage();
  const { user } = useAdminAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [workerMessage, setWorkerMessage] = useState("");
  const [draftEntries, setDraftEntries] = useState<VacationDayEntry[]>([]);
  const [carryDaysRequested, setCarryDaysRequested] = useState("");
  const [carryMessage, setCarryMessage] = useState("");

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
    data: vacationEntries = [],
    isLoading: vacationLoading,
    isError: vacationError,
    error: vacationErr,
  } = useWorkerVacationDays(workerId, year);
  const { data: vacationRequests = [] } = useWorkerVacationChangeHistory(workerId);
  const pendingRequestForYear = useMemo(
    () => vacationRequests.find((r) => r.status === "PENDING" && r.calendarYear === year),
    [vacationRequests, year]
  );

  const sourceYear = year - 1;
  const { data: carryAllow = 0 } = useQuery({
    queryKey: ["approvedCarryoverAllowance", workerId, year, sourceYear] as const,
    queryFn: () => fetchApprovedCarryoverAllowance(workerId!, year, sourceYear),
    enabled: !!workerId && year > 2000,
  });
  const { data: unusedPrev = 0 } = useQuery({
    queryKey: ["unusedStandardPrevYear", workerId, sourceYear, worker?.vacationDays] as const,
    queryFn: () => getUnusedStandardDaysInYear(workerId!, sourceYear, worker!.vacationDays),
    enabled: !!workerId && !!worker,
  });

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
      setDraftEntries(
        pendingRequestForYear.proposedEntries?.length
          ? pendingRequestForYear.proposedEntries
          : pendingRequestForYear.proposedDates.map((d) => ({ date: d, carryoverFromYear: null }))
      );
      setWorkerMessage(pendingRequestForYear.workerMessage || "");
      return;
    }
    setDraftEntries(vacationEntries);
    setWorkerMessage("");
  }, [vacationEntries, pendingRequestForYear]);

  const vacationIsoSet = useMemo(() => new Set(draftEntries.map((e) => e.date)), [draftEntries]);
  const vacationCarryoverIsoSet = useMemo(
    () =>
      new Set(
        draftEntries.filter((e) => e.carryoverFromYear != null).map((e) => e.date)
      ),
    [draftEntries]
  );
  const approvedIsoSet = useMemo(() => new Set(vacationEntries.map((e) => e.date)), [vacationEntries]);
  const approvedPastIsoSet = useMemo(
    () => new Set(vacationEntries.filter((e) => e.date < todayIso).map((e) => e.date)),
    [vacationEntries, todayIso]
  );

  const { standardN, carryN } = useMemo(
    () => countStandardAndCarry(draftEntries, year),
    [draftEntries, year]
  );
  const maxDays = worker?.vacationDays ?? 0;
  const remainingAnnual = Math.max(0, maxDays - standardN);
  const remainingCarry = Math.max(0, carryAllow - carryN);
  const hasDraftChanges = !vacationEntriesEqual(draftEntries, vacationEntries);

  const canVacationClick = useCallback(
    (iso: string) => {
      if (iso < todayIso) return false;
      if (vacationIsoSet.has(iso)) return true;
      if (isWeekendIso(iso)) return false;
      if (holidayDateSet.has(iso)) return false;
      if (standardN < maxDays) return true;
      if (carryN < carryAllow) return true;
      return false;
    },
    [todayIso, vacationIsoSet, holidayDateSet, standardN, maxDays, carryN, carryAllow]
  );

  const submitMutation = useMutation({
    mutationFn: () =>
      submitWorkerVacationChangeRequest({
        calendarYear: year,
        proposedEntries: normalizeVacationEntries(draftEntries),
        workerMessage,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workerVacationChangeRequests });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.workerVacationChangeRequestsFor(workerId ?? ""),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminVacationSummaries(year) });
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

  const carryoverMutation = useMutation({
    mutationFn: () =>
      submitCarryoverRequest({
        sourceYear,
        targetYear: year,
        daysRequested: Math.floor(Number(carryDaysRequested)),
        workerMessage: carryMessage,
      }),
    onSuccess: async () => {
      setCarryDaysRequested("");
      setCarryMessage("");
      await queryClient.invalidateQueries({ queryKey: ["approvedCarryoverAllowance"] });
      await queryClient.invalidateQueries({ queryKey: ["unusedStandardPrevYear"] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminVacationSummaries(year) });
      toast({ title: t("admin.workerMyCalendar.carryover_toast_sent") });
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

  const toggleDraftDate = (iso: string) => {
    if (pendingRequestForYear || submitMutation.isPending) return;
    setDraftEntries((prev) => {
      const exists = prev.find((p) => p.date === iso);
      if (exists) {
        return prev.filter((p) => p.date !== iso);
      }
      if (isWeekendIso(iso) || holidayDateSet.has(iso)) return prev;
      const { standardN: sN, carryN: cN } = countStandardAndCarry(prev, year);
      if (sN < maxDays) {
        return normalizeVacationEntries([...prev, { date: iso, carryoverFromYear: null }]);
      }
      if (cN < carryAllow) {
        return normalizeVacationEntries([
          ...prev,
          { date: iso, carryoverFromYear: sourceYear },
        ]);
      }
      toast({
        title: t("admin.common.error"),
        description: t("admin.workerMyCalendar.error_no_slots"),
        variant: "destructive",
      });
      return prev;
    });
  };

  const carryParsed = Math.floor(Number(carryDaysRequested));
  const canSubmitCarry =
    Number.isFinite(carryParsed) &&
    carryParsed >= 1 &&
    carryParsed <= unusedPrev &&
    !carryoverMutation.isPending;

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
            <span className="text-muted-foreground">{t("admin.workerMyCalendar.draft_total")}</span>{" "}
            <span className="font-semibold tabular-nums">{draftEntries.length}</span>
          </p>
          <p>
            <span className="text-muted-foreground">{t("admin.workerMyCalendar.draft_annual")}</span>{" "}
            <span className="font-semibold tabular-nums">
              {standardN}/{maxDays}
            </span>
          </p>
          <p>
            <span className="text-muted-foreground">{t("admin.workerMyCalendar.draft_carry")}</span>{" "}
            <span className="font-semibold tabular-nums">
              {carryN}/{Math.max(0, carryAllow)}
            </span>
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
            <span className="text-muted-foreground">{t("admin.workerMyCalendar.vacation_remaining_annual")}</span>{" "}
            <span className="font-semibold tabular-nums text-primary">{remainingAnnual}</span>
          </p>
          {carryAllow > 0 ? (
            <p>
              <span className="text-muted-foreground">
                {t("admin.workerMyCalendar.vacation_remaining_carry")}
              </span>{" "}
              <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                {remainingCarry}
              </span>
            </p>
          ) : null}
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
          <CardTitle className="text-base">{t("admin.workerMyCalendar.carryover_card_title")}</CardTitle>
          <CardDescription>
            {t("admin.workerMyCalendar.carryover_card_desc")
              .replace(/\{\{prev\}\}/g, String(sourceYear))
              .replace(/\{\{next\}\}/g, String(year))}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 max-w-lg">
          <p className="text-sm text-muted-foreground">
            {t("admin.workerMyCalendar.carryover_unused_line")
              .replace(/\{\{prev\}\}/g, String(sourceYear))
              .replace(/\{\{days\}\}/g, String(unusedPrev))}
          </p>
          {unusedPrev > 0 ? (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="carry-days">
                    {t("admin.workerMyCalendar.carryover_days_label")}
                  </label>
                  <Input
                    id="carry-days"
                    type="number"
                    min={1}
                    max={unusedPrev}
                    className="w-28 h-9"
                    value={carryDaysRequested}
                    onChange={(e) => setCarryDaysRequested(e.target.value)}
                    disabled={carryoverMutation.isPending}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!canSubmitCarry}
                  onClick={() => carryoverMutation.mutate()}
                >
                  {carryoverMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {t("admin.workerMyCalendar.carryover_send")}
                </Button>
              </div>
              <Textarea
                value={carryMessage}
                onChange={(e) => setCarryMessage(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder={t("admin.workerMyCalendar.carryover_message_ph")}
                disabled={carryoverMutation.isPending}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("admin.workerMyCalendar.carryover_no_unused")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.workerMyCalendar.grid_title")}</CardTitle>
          <CardDescription>
            {t("admin.workerMyCalendar.grid_desc")} {t("admin.workerMyCalendar.grid_past_locked")}
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
              vacationCarryoverIsoSet={vacationCarryoverIsoSet}
              vacationPastIsoSet={approvedPastIsoSet}
              onVacationDayClick={toggleDraftDate}
              vacationDayCanClick={vacationDayCanClick}
              vacationLegendLabel={t("admin.workerMyCalendar.legend_vacation")}
              vacationTooltipLine={t("admin.workerMyCalendar.tooltip_vacation")}
              vacationCarryoverLegendLabel={t("admin.workerMyCalendar.legend_vacation_carryover")}
              vacationCarryoverTooltipLine={t("admin.workerMyCalendar.tooltip_vacation_carryover").replace(
                "{{prevYear}}",
                String(sourceYear)
              )}
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
