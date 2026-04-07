import { Fragment, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock3, Loader2, Send } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import { queryKeys } from "@/lib/queryKeys";
import { useMyTimeClockEvents } from "@/hooks/useTimeTracking";
import {
  computeDailyTimeSummaries,
  createMyTimeClockEvent,
  requestTimeClockCorrection,
  type CreateTimeClockEventInput,
} from "@/api/timeTrackingApi";
import { useToast } from "@/hooks/use-toast";

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function kindLabel(kind: string, t: (k: string) => string): string {
  return t(`admin.timeClock.kind_${kind.toLowerCase()}`);
}

const WorkerTimeClock = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const now = new Date();
  const initialMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(initialMonth);
  const [comment, setComment] = useState("");
  const [absenceReason, setAbsenceReason] = useState("");
  const [correctionMessage, setCorrectionMessage] = useState("");
  const [correctionDate, setCorrectionDate] = useState(todayIso());
  const [expandedDayIso, setExpandedDayIso] = useState<string | null>(null);
  const { from, to } = useMemo(() => monthRange(month), [month]);

  const { data: events = [], isLoading, isError, error } = useMyTimeClockEvents(from, to);
  const { data: correctionDayEvents = [] } = useMyTimeClockEvents(
    correctionDate || todayIso(),
    correctionDate || todayIso(),
    Boolean(correctionDate)
  );
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

  const daily = useMemo(() => computeDailyTimeSummaries(events), [events]);
  const eventsByDay = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const e of events) {
      const d = e.eventAt.slice(0, 10);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(e);
    }
    return map;
  }, [events]);
  const correctionDaySummary = useMemo(
    () => computeDailyTimeSummaries(correctionDayEvents)[0] ?? null,
    [correctionDayEvents]
  );

  const createMutation = useMutation({
    mutationFn: (input: CreateTimeClockEventInput) => createMyTimeClockEvent(input),
    onSuccess: async () => {
      setComment("");
      setAbsenceReason("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.myTimeClockEvents(from, to) });
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

  const correctionMutation = useMutation({
    mutationFn: () =>
      requestTimeClockCorrection({ message: correctionMessage.trim(), relatedDate: correctionDate || undefined }),
    onSuccess: () => {
      setCorrectionMessage("");
      toast({ title: t("admin.timeClock.toast_request_sent") });
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.timeClock.toast_request_error"),
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
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Clock3 className="h-6 w-6 text-primary" />
          {t("admin.timeClock.worker_title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t("admin.timeClock.worker_subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.timeClock.today_card")}</CardTitle>
          <CardDescription>
            {todayState.absent
              ? t("admin.timeClock.state_absent")
              : todayState.onBreak
                ? t("admin.timeClock.state_break")
                : todayState.inWork
                  ? t("admin.timeClock.state_working")
                  : todayState.hasClockOut
                    ? t("admin.timeClock.state_day_finished")
                    : t("admin.timeClock.state_idle")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Button
              type="button"
              onClick={() => createMutation.mutate({ eventKind: "CLOCK_IN", comment })}
              disabled={createMutation.isPending || todayState.absent || todayState.inWork || todayState.hasClockIn}
            >
              {t("admin.timeClock.action_clock_in")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => createMutation.mutate({ eventKind: "BREAK_START", comment })}
              disabled={
                createMutation.isPending ||
                todayState.absent ||
                !todayState.inWork ||
                todayState.onBreak ||
                !comment.trim()
              }
            >
              {t("admin.timeClock.action_break_start")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => createMutation.mutate({ eventKind: "BREAK_END", comment })}
              disabled={createMutation.isPending || todayState.absent || !todayState.onBreak}
            >
              {t("admin.timeClock.action_break_end")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => createMutation.mutate({ eventKind: "CLOCK_OUT", comment })}
              disabled={createMutation.isPending || todayState.absent || !todayState.inWork || todayState.hasClockOut}
            >
              {t("admin.timeClock.action_clock_out")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => createMutation.mutate({ eventKind: "ABSENCE", absenceReason, comment })}
              disabled={createMutation.isPending || todayEvents.length > 0 || !absenceReason.trim()}
            >
              {t("admin.timeClock.action_absence")}
            </Button>
          </div>
          <Input
            value={absenceReason}
            onChange={(e) => setAbsenceReason(e.target.value)}
            placeholder={t("admin.timeClock.absence_reason_placeholder")}
          />
          <Textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("admin.timeClock.comment_placeholder")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.timeClock.request_fix_title")}</CardTitle>
          <CardDescription>{t("admin.timeClock.request_fix_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <Input type="date" value={correctionDate} onChange={(e) => setCorrectionDate(e.target.value)} />
            <Textarea
              rows={2}
              value={correctionMessage}
              onChange={(e) => setCorrectionMessage(e.target.value)}
              placeholder={t("admin.timeClock.request_fix_placeholder")}
            />
          </div>
          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{t("admin.timeClock.request_fix_day_summary")}</p>
            {correctionDaySummary ? (
              <>
                <p className="text-sm">
                  {t("admin.timeClock.request_fix_day_hours").replace(
                    "{{hours}}",
                    (correctionDaySummary.workedMinutes / 60).toFixed(2)
                  )}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {correctionDayEvents.map((e) => (
                    <Badge key={e.id} variant="outline" className="text-[11px]">
                      {formatTime(e.eventAt)} · {kindLabel(e.eventKind, t)}
                    </Badge>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("admin.timeClock.request_fix_day_empty")}</p>
            )}
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              className="gap-1.5"
              onClick={() => correctionMutation.mutate()}
              disabled={!correctionMessage.trim() || correctionMutation.isPending}
            >
              <Send className="h-4 w-4" />
              {t("admin.timeClock.request_fix_send")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.timeClock.history_title")}</CardTitle>
          <CardDescription>{t("admin.timeClock.history_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value || initialMonth)} />
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.timeClock.col_date")}</TableHead>
                  <TableHead className="text-right">{t("admin.timeClock.col_worked_hours")}</TableHead>
                  <TableHead>{t("admin.timeClock.col_absence")}</TableHead>
                  <TableHead className="text-right">{t("admin.timeClock.col_events_count")}</TableHead>
                  <TableHead className="text-right">{t("admin.timeClock.col_detail")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daily.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {t("admin.timeClock.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  daily.map((d) => {
                    const dayEvents = eventsByDay.get(d.dayIso) ?? [];
                    const expanded = expandedDayIso === d.dayIso;
                    return (
                      <Fragment key={d.dayIso}>
                        <TableRow>
                          <TableCell>{d.dayIso}</TableCell>
                          <TableCell className="text-right tabular-nums">{(d.workedMinutes / 60).toFixed(2)}</TableCell>
                          <TableCell>{d.hasAbsence ? d.absenceReason ?? t("admin.timeClock.state_absent") : "—"}</TableCell>
                          <TableCell className="text-right">{dayEvents.length}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setExpandedDayIso(expanded ? null : d.dayIso)}
                            >
                              {expanded ? t("admin.timeClock.hide_detail") : t("admin.timeClock.show_detail")}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expanded ? (
                          <TableRow>
                            <TableCell colSpan={5}>
                              <div className="rounded-md border bg-muted/20 p-3 overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>{t("admin.timeClock.col_event_at")}</TableHead>
                                      <TableHead>{t("admin.timeClock.col_kind")}</TableHead>
                                      <TableHead>{t("admin.timeClock.col_comment")}</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {dayEvents.map((e) => (
                                      <TableRow key={e.id}>
                                        <TableCell className="whitespace-nowrap">{formatTime(e.eventAt)}</TableCell>
                                        <TableCell>
                                          <Badge variant="outline">{kindLabel(e.eventKind, t)}</Badge>
                                        </TableCell>
                                        <TableCell className="max-w-[520px] whitespace-pre-wrap">
                                          {e.comment ||
                                            (e.eventKind === "BREAK_START"
                                              ? t("admin.timeClock.pause_default_reason")
                                              : e.absenceReason) ||
                                            "—"}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkerTimeClock;
