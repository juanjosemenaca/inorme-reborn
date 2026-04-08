import { Fragment, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMyTimeClockEvents } from "@/hooks/useTimeTracking";
import { computeDailyTimeSummaries } from "@/api/timeTrackingApi";
import { monthRange, timeClockKindLabel } from "@/pages/admin/workerTimeClockShared";

const WorkerTimeClockHistory = () => {
  const { t, language } = useLanguage();
  const now = new Date();
  const initialMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(initialMonth);
  const [expandedDayIso, setExpandedDayIso] = useState<string | null>(null);
  const { from, to } = useMemo(() => monthRange(month), [month]);

  const { data: events = [], isLoading, isError, error } = useMyTimeClockEvents(from, to);
  const localeTag = language === "en" ? "en-GB" : language === "ca" ? "ca-ES" : "es-ES";
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" });

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
      <p className="py-8 text-sm text-destructive">
        {error instanceof Error ? error.message : t("admin.timeClock.load_error")}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-1 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:px-0">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("admin.timeClock.history_title")}</h1>
        <p className="mt-1.5 text-base text-muted-foreground sm:text-sm">{t("admin.timeClock.history_desc")}</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.timeClock.history_title")}</CardTitle>
          <CardDescription>{t("admin.timeClock.history_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value || initialMonth)}
            className="min-h-11 max-w-full text-base md:max-w-xs md:text-sm"
            aria-label={t("admin.timeClock.history_month_aria")}
          />
          <div className="overflow-x-auto rounded-md border">
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
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
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
                          <TableCell>{d.hasAbsence ? (d.absenceReason ?? t("admin.timeClock.state_absent")) : "—"}</TableCell>
                          <TableCell className="text-right">{dayEvents.length}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="min-h-11 touch-manipulation sm:min-h-9"
                              onClick={() => setExpandedDayIso(expanded ? null : d.dayIso)}
                            >
                              {expanded ? t("admin.timeClock.hide_detail") : t("admin.timeClock.show_detail")}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expanded ? (
                          <TableRow>
                            <TableCell colSpan={5}>
                              <div className="overflow-x-auto rounded-md border bg-muted/20 p-3">
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
                                          <Badge variant="outline">{timeClockKindLabel(e.eventKind, t)}</Badge>
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

export default WorkerTimeClockHistory;
