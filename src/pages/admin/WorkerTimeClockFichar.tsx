import { useMemo, useState, type ComponentType } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  CalendarX,
  CheckCircle2,
  Clock,
  Clock3,
  Coffee,
  Loader2,
  LogIn,
  LogOut,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMyTimeClockEvents } from "@/hooks/useTimeTracking";
import { createMyTimeClockEvent, type CreateTimeClockEventInput } from "@/api/timeTrackingApi";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { monthRange, todayIso, timeClockKindLabel } from "@/pages/admin/workerTimeClockShared";

type WorkerVisualState = "idle" | "working" | "break" | "finished" | "absent";

function resolveWorkerVisualState(s: {
  absent: boolean;
  onBreak: boolean;
  inWork: boolean;
  hasClockOut: boolean;
}): WorkerVisualState {
  if (s.absent) return "absent";
  if (s.onBreak) return "break";
  if (s.inWork) return "working";
  if (s.hasClockOut) return "finished";
  return "idle";
}

const WORKER_STATUS_CONFIG: Record<
  WorkerVisualState,
  {
    Icon: ComponentType<{ className?: string }>;
    panelClass: string;
    iconWrapClass: string;
    accentClass: string;
  }
> = {
  idle: {
    Icon: LogIn,
    panelClass: "border-muted-foreground/20 bg-muted/50",
    iconWrapClass: "bg-background text-muted-foreground shadow-sm",
    accentClass: "text-muted-foreground",
  },
  working: {
    Icon: Briefcase,
    panelClass: "border-emerald-500/35 bg-emerald-500/[0.08] dark:bg-emerald-500/10",
    iconWrapClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    accentClass: "text-emerald-700 dark:text-emerald-400",
  },
  break: {
    Icon: Coffee,
    panelClass: "border-amber-500/40 bg-amber-500/[0.09] dark:bg-amber-500/12",
    iconWrapClass: "bg-amber-500/15 text-amber-800 dark:text-amber-400",
    accentClass: "text-amber-800 dark:text-amber-400",
  },
  finished: {
    Icon: CheckCircle2,
    panelClass: "border-sky-500/35 bg-sky-500/[0.07] dark:bg-sky-500/10",
    iconWrapClass: "bg-sky-500/15 text-sky-800 dark:text-sky-400",
    accentClass: "text-sky-800 dark:text-sky-400",
  },
  absent: {
    Icon: CalendarX,
    panelClass: "border-destructive/35 bg-destructive/[0.06]",
    iconWrapClass: "bg-destructive/15 text-destructive",
    accentClass: "text-destructive",
  },
};

const WorkerTimeClockFichar = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const now = new Date();
  const initialMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(initialMonth);
  const [journeyComment, setJourneyComment] = useState("");
  const [pauseComment, setPauseComment] = useState("");
  const [absenceReason, setAbsenceReason] = useState("");
  const [absenceOptionalNote, setAbsenceOptionalNote] = useState("");
  const { from, to } = useMemo(() => monthRange(month), [month]);

  const { data: events = [], isLoading, isError, error } = useMyTimeClockEvents(from, to);
  const localeTag = language === "en" ? "en-GB" : language === "ca" ? "ca-ES" : "es-ES";
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" });

  const todayEvents = useMemo(() => events.filter((e) => e.eventAt.slice(0, 10) === todayIso()), [events]);
  const todayState = useMemo(() => {
    let inWork = false;
    let onBreak = false;
    let absent = false;
    let hasClockIn = false;
    let hasClockOut = false;
    for (const e of [...todayEvents].sort((a, b) => a.eventAt.localeCompare(b.eventAt))) {
      if (e.eventKind === "ABSENCE") {
        absent = true;
        inWork = false;
        onBreak = false;
      } else if (e.eventKind === "CLOCK_IN") {
        hasClockIn = true;
        inWork = true;
        onBreak = false;
      } else if (e.eventKind === "BREAK_START" && inWork) {
        onBreak = true;
      } else if (e.eventKind === "BREAK_END" && inWork) {
        onBreak = false;
      } else if (e.eventKind === "CLOCK_OUT") {
        hasClockOut = true;
        inWork = false;
        onBreak = false;
      }
    }
    return { inWork, onBreak, absent, hasClockIn, hasClockOut };
  }, [todayEvents]);

  const visualState = useMemo(() => resolveWorkerVisualState(todayState), [todayState]);
  const statusLabel = useMemo(() => {
    if (todayState.absent) return t("admin.timeClock.state_absent");
    if (todayState.onBreak) return t("admin.timeClock.state_break");
    if (todayState.inWork) return t("admin.timeClock.state_working");
    if (todayState.hasClockOut) return t("admin.timeClock.state_day_finished");
    return t("admin.timeClock.state_idle");
  }, [todayState, t]);

  const todayLongDate = useMemo(
    () =>
      new Date().toLocaleDateString(localeTag, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [localeTag]
  );

  const todaySortedEvents = useMemo(
    () => [...todayEvents].sort((a, b) => a.eventAt.localeCompare(b.eventAt)),
    [todayEvents]
  );

  const statusVisual = WORKER_STATUS_CONFIG[visualState];
  const StatusHeroIcon = statusVisual.Icon;

  const createMutation = useMutation({
    mutationFn: (input: CreateTimeClockEventInput) => createMyTimeClockEvent(input),
    onSuccess: async () => {
      setJourneyComment("");
      setPauseComment("");
      setAbsenceReason("");
      setAbsenceOptionalNote("");
      await queryClient.invalidateQueries({ queryKey: ["myTimeClockEvents"] });
      toast({ title: t("admin.timeClock.toast_saved") });
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.timeClock.toast_save_error"),
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        {t("admin.common.loading")}
      </div>
    );
  }
  if (isError) {
    return (
      <p className="text-destructive text-sm py-8">
        {error instanceof Error ? error.message : t("admin.timeClock.load_error")}
      </p>
    );
  }

  return (
    <div
      className="mx-auto max-w-5xl space-y-6 px-1 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:px-0"
      aria-busy={createMutation.isPending}
    >
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Clock3 className="h-7 w-7 shrink-0 text-primary" aria-hidden />
          {t("admin.timeClock.worker_title")}
        </h1>
        <p className="mt-1.5 text-base text-muted-foreground sm:text-sm">{t("admin.timeClock.worker_subtitle")}</p>
      </div>

      <Card className="overflow-hidden border-2 shadow-md">
        <CardHeader className="sr-only">
          <CardTitle>{t("admin.timeClock.today_card")}</CardTitle>
        </CardHeader>

        <div
          className={cn("border-b border-border/50 px-4 py-5 sm:px-6", statusVisual.panelClass)}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label={t("admin.timeClock.worker_status_a11y_label")}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <div
                className={cn(
                  "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-2 ring-background/80",
                  statusVisual.iconWrapClass
                )}
                aria-hidden
              >
                <StatusHeroIcon className="h-7 w-7" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className={cn("text-xs font-semibold uppercase tracking-wide", statusVisual.accentClass)}>
                  {todayLongDate}
                </p>
                <p className="mt-1 text-xl font-semibold leading-snug sm:text-2xl">{statusLabel}</p>
                {createMutation.isPending ? (
                  <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                    {t("admin.timeClock.worker_saving")}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="border-b bg-muted/25 px-4 py-4 sm:px-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("admin.timeClock.worker_today_log_title")}
          </p>
          {todaySortedEvents.length === 0 ? (
            <p className="text-base text-muted-foreground sm:text-sm">{t("admin.timeClock.worker_today_log_empty")}</p>
          ) : (
            <ul className="flex flex-wrap gap-2" role="list" aria-label={t("admin.timeClock.worker_today_log_title")}>
              {todaySortedEvents.map((e) => (
                <li key={e.id}>
                  <Badge
                    variant="secondary"
                    className="h-auto gap-1.5 border border-border/60 py-2 pl-2.5 pr-3 text-base font-normal leading-tight shadow-sm sm:text-sm"
                  >
                    <Clock className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                    <span className="tabular-nums">{formatTime(e.eventAt)}</span>
                    <span className="text-muted-foreground" aria-hidden>
                      ·
                    </span>
                    <span>{timeClockKindLabel(e.eventKind, t)}</span>
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <CardContent className="space-y-8 pt-6 sm:pt-8">
          {/* 1. Jornada */}
          <section
            aria-labelledby="worker-tc-journey-heading"
            className="rounded-xl border border-border bg-card/90 p-4 shadow-sm sm:p-5 border-l-[5px] border-l-primary"
          >
            <div className="mb-4 flex gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary"
                aria-hidden
              >
                <LogIn className="h-6 w-6" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h2 id="worker-tc-journey-heading" className="text-lg font-semibold leading-tight">
                  {t("admin.timeClock.worker_section_journey_title")}
                </h2>
                <p className="mt-1 text-base text-muted-foreground sm:text-sm">{t("admin.timeClock.worker_section_journey_desc")}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                type="button"
                size="lg"
                className="min-h-12 w-full touch-manipulation justify-center gap-2 text-base sm:min-h-11"
                onClick={() => createMutation.mutate({ eventKind: "CLOCK_IN", comment: journeyComment })}
                disabled={createMutation.isPending || todayState.absent || todayState.inWork || todayState.hasClockIn}
              >
                <LogIn className="h-5 w-5 shrink-0" aria-hidden />
                {t("admin.timeClock.action_clock_in")}
              </Button>
              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="min-h-12 w-full touch-manipulation justify-center gap-2 text-base sm:min-h-11"
                onClick={() => createMutation.mutate({ eventKind: "CLOCK_OUT", comment: journeyComment })}
                disabled={createMutation.isPending || todayState.absent || !todayState.inWork || todayState.hasClockOut}
              >
                <LogOut className="h-5 w-5 shrink-0" aria-hidden />
                {t("admin.timeClock.action_clock_out")}
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="worker-tc-journey-comment" className="text-base font-medium sm:text-sm">
                {t("admin.timeClock.worker_journey_comment_label")}
              </Label>
              <Textarea
                id="worker-tc-journey-comment"
                rows={2}
                value={journeyComment}
                onChange={(e) => setJourneyComment(e.target.value)}
                placeholder={t("admin.timeClock.worker_journey_comment_placeholder")}
                className="resize-none text-base md:text-sm"
              />
            </div>
          </section>

          <Separator className="bg-border/80" />

          {/* 2. Pausas */}
          <section
            aria-labelledby="worker-tc-pause-heading"
            className="rounded-xl border border-border bg-card/90 p-4 shadow-sm sm:p-5 border-l-[5px] border-l-amber-500"
          >
            <div className="mb-4 flex gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-400"
                aria-hidden
              >
                <Coffee className="h-6 w-6" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h2 id="worker-tc-pause-heading" className="text-lg font-semibold leading-tight">
                  {t("admin.timeClock.worker_section_pause_title")}
                </h2>
                <p className="mt-1 text-base text-muted-foreground sm:text-sm">{t("admin.timeClock.worker_section_pause_desc")}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="worker-tc-pause-comment" className="text-base font-medium sm:text-sm">
                {t("admin.timeClock.worker_pause_comment_label")}
              </Label>
              <Textarea
                id="worker-tc-pause-comment"
                rows={2}
                value={pauseComment}
                onChange={(e) => setPauseComment(e.target.value)}
                placeholder={t("admin.timeClock.worker_pause_comment_placeholder")}
                className="resize-none text-base md:text-sm"
              />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="min-h-12 w-full touch-manipulation justify-center gap-2 border-2 text-base sm:min-h-11"
                onClick={() => createMutation.mutate({ eventKind: "BREAK_START", comment: pauseComment })}
                disabled={
                  createMutation.isPending ||
                  todayState.absent ||
                  !todayState.inWork ||
                  todayState.onBreak ||
                  !pauseComment.trim()
                }
              >
                <Coffee className="h-5 w-5 shrink-0" aria-hidden />
                {t("admin.timeClock.action_break_start")}
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="min-h-12 w-full touch-manipulation justify-center gap-2 border-2 text-base sm:min-h-11"
                onClick={() => createMutation.mutate({ eventKind: "BREAK_END", comment: "" })}
                disabled={createMutation.isPending || todayState.absent || !todayState.onBreak}
              >
                <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
                {t("admin.timeClock.action_break_end")}
              </Button>
            </div>
            {!todayState.absent && !todayState.inWork ? (
              <p className="mt-3 flex gap-2 text-base text-muted-foreground sm:text-sm">
                <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
                {t("admin.timeClock.worker_hint_pause_need_clock_in")}
              </p>
            ) : null}
            {todayState.inWork && !todayState.onBreak && !pauseComment.trim() ? (
              <p className="mt-3 flex gap-2 text-base text-muted-foreground sm:text-sm">
                <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
                {t("admin.timeClock.worker_hint_pause_need_reason")}
              </p>
            ) : null}
          </section>

          <Separator className="bg-border/80" />

          {/* 3. Ausencia */}
          <section
            aria-labelledby="worker-tc-absence-heading"
            className="rounded-xl border-2 border-destructive/30 bg-destructive/[0.04] p-4 shadow-inner sm:p-5 border-l-[5px] border-l-destructive"
          >
            <div className="mb-4 flex gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive"
                aria-hidden
              >
                <CalendarX className="h-6 w-6" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h2 id="worker-tc-absence-heading" className="text-lg font-semibold leading-tight">
                  {t("admin.timeClock.worker_section_absence_title")}
                </h2>
                <p className="mt-1 text-base text-muted-foreground sm:text-sm">{t("admin.timeClock.worker_section_absence_desc")}</p>
              </div>
            </div>
            {todayEvents.length > 0 ? (
              <p className="mb-4 rounded-lg bg-muted/80 px-3 py-2.5 text-base text-muted-foreground sm:text-sm" role="status">
                {t("admin.timeClock.worker_hint_absence_locked")}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="worker-tc-absence-reason" className="text-base font-medium sm:text-sm">
                {t("admin.timeClock.worker_absence_reason_label")}
              </Label>
              <Input
                id="worker-tc-absence-reason"
                value={absenceReason}
                onChange={(e) => setAbsenceReason(e.target.value)}
                placeholder={t("admin.timeClock.absence_reason_placeholder")}
                className="min-h-11 text-base md:text-sm"
                autoComplete="off"
              />
            </div>
            <div className="mt-3 space-y-2">
              <Label htmlFor="worker-tc-absence-note" className="text-base font-medium text-muted-foreground sm:text-sm">
                {t("admin.timeClock.worker_absence_optional_note_label")}
              </Label>
              <Textarea
                id="worker-tc-absence-note"
                rows={2}
                value={absenceOptionalNote}
                onChange={(e) => setAbsenceOptionalNote(e.target.value)}
                placeholder={t("admin.timeClock.worker_absence_optional_note_placeholder")}
                className="resize-none text-base md:text-sm"
              />
            </div>
            <Button
              type="button"
              size="lg"
              variant="destructive"
              className="mt-4 min-h-12 w-full touch-manipulation gap-2 text-base sm:w-auto sm:min-h-11"
              onClick={() =>
                createMutation.mutate({
                  eventKind: "ABSENCE",
                  absenceReason,
                  comment: absenceOptionalNote,
                })
              }
              disabled={createMutation.isPending || todayEvents.length > 0 || !absenceReason.trim()}
            >
              <CalendarX className="h-5 w-5 shrink-0" aria-hidden />
              {t("admin.timeClock.action_absence")}
            </Button>
          </section>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkerTimeClockFichar;
