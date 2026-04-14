import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check, ChevronsUpDown, Clock3, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompanyWorkers } from "@/hooks/useCompanyWorkers";
import { useWorkerTimeClockEvents } from "@/hooks/useTimeTracking";
import { queryKeys } from "@/lib/queryKeys";
import {
  computeDailyTimeSummaries,
  createAdminTimeClockEvent,
  deleteTimeClockDayAsAdmin,
  deleteTimeClockEventAsAdmin,
  updateTimeClockEventAsAdmin,
  type CreateTimeClockEventInput,
} from "@/api/timeTrackingApi";
import type { CompanyWorkerRecord } from "@/types/companyWorkers";
import type { TimeClockEventKind } from "@/types/timeTracking";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function localInputToIso(local: string): string {
  return new Date(local).toISOString();
}

const EVENT_KINDS: TimeClockEventKind[] = ["CLOCK_IN", "BREAK_START", "BREAK_END", "CLOCK_OUT", "ABSENCE"];

/** Cadena en minúsculas para filtrar en el combobox (cmdk busca por `value`). */
function workerSearchValue(w: CompanyWorkerRecord): string {
  return [w.firstName, w.lastName, w.email, w.dni, w.mobile, w.city].join(" ").toLowerCase();
}

const AdminTimeClock = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const workersQuery = useCompanyWorkers();
  const now = new Date();
  const initialMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(initialMonth);
  const [workerId, setWorkerId] = useState<string>("");
  const [workerComboOpen, setWorkerComboOpen] = useState(false);
  const [newKind, setNewKind] = useState<TimeClockEventKind>("CLOCK_IN");
  const [newAt, setNewAt] = useState("");
  const [newComment, setNewComment] = useState("");
  const [newAbsenceReason, setNewAbsenceReason] = useState("");
  const [expandedDayIso, setExpandedDayIso] = useState<string | null>(null);
  const [draftById, setDraftById] = useState<Record<string, { kind: TimeClockEventKind; at: string; comment: string; absenceReason: string }>>({});
  const workers = useMemo(() => (workersQuery.data ?? []).filter((w) => w.active), [workersQuery.data]);
  const selectedWorker = useMemo(() => workers.find((w) => w.id === workerId), [workers, workerId]);
  const { from, to } = useMemo(() => monthRange(month), [month]);

  useEffect(() => {
    if (!workerId && workers.length > 0) {
      setWorkerId(workers[0].id);
    }
  }, [workerId, workers]);

  const eventsQuery = useWorkerTimeClockEvents(workerId || null, from, to, !!workerId);
  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
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
  const totalHours = useMemo(
    () => daily.reduce((acc, d) => acc + d.workedMinutes, 0) / 60,
    [daily]
  );

  const localeTag = language === "en" ? "en-GB" : language === "ca" ? "ca-ES" : "es-ES";
  const formatDt = (iso: string) =>
    new Date(iso).toLocaleString(localeTag, { dateStyle: "short", timeStyle: "short" });

  const createMutation = useMutation({
    mutationFn: (input: CreateTimeClockEventInput) => createAdminTimeClockEvent(workerId, input),
    onSuccess: async () => {
      setNewComment("");
      setNewAbsenceReason("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.workerTimeClockEvents(workerId, from, to) });
      toast({ title: t("admin.timeClock.toast_saved") });
    },
    onError: (e) =>
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.timeClock.toast_save_error"),
        variant: "destructive",
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<CreateTimeClockEventInput> }) =>
      updateTimeClockEventAsAdmin(id, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workerTimeClockEvents(workerId, from, to) });
      toast({ title: t("admin.timeClock.toast_saved") });
    },
    onError: (e) =>
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.timeClock.toast_save_error"),
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTimeClockEventAsAdmin(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workerTimeClockEvents(workerId, from, to) });
      toast({ title: t("admin.timeClock.toast_deleted") });
    },
    onError: (e) =>
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.timeClock.toast_delete_error"),
        variant: "destructive",
      }),
  });

  const deleteDayMutation = useMutation({
    mutationFn: (dayIso: string) => deleteTimeClockDayAsAdmin(workerId, dayIso),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workerTimeClockEvents(workerId, from, to) });
      toast({ title: t("admin.timeClock.toast_deleted_day") });
    },
    onError: (e) =>
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.timeClock.toast_delete_day_error"),
        variant: "destructive",
      }),
  });

  useEffect(() => {
    setDraftById(
      events.reduce<Record<string, { kind: TimeClockEventKind; at: string; comment: string; absenceReason: string }>>(
        (acc, e) => {
          acc[e.id] = {
            kind: e.eventKind,
            at: toLocalInput(e.eventAt),
            comment: e.comment ?? "",
            absenceReason: e.absenceReason ?? "",
          };
          return acc;
        },
        {}
      )
    );
  }, [events]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Clock3 className="h-6 w-6 text-primary" />
          {t("admin.timeClock.admin_title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t("admin.timeClock.admin_subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.timeClock.filters_title")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <Popover open={workerComboOpen} onOpenChange={setWorkerComboOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={workerComboOpen}
                className={cn("w-full justify-between font-normal", !workerId && "text-muted-foreground")}
              >
                {selectedWorker
                  ? `${selectedWorker.firstName} ${selectedWorker.lastName}`.trim()
                  : t("admin.timeClock.select_worker")}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[min(calc(100vw-2rem),32rem)]" align="start">
              <Command>
                <CommandInput placeholder={t("admin.timeClock.worker_search_placeholder")} />
                <CommandList>
                  <CommandEmpty>{t("admin.timeClock.worker_search_empty")}</CommandEmpty>
                  <CommandGroup>
                    {workers.map((w) => (
                      <CommandItem
                        key={w.id}
                        value={workerSearchValue(w)}
                        onSelect={() => {
                          setWorkerId(w.id);
                          setWorkerComboOpen(false);
                        }}
                      >
                        <Check
                          className={cn("mr-2 h-4 w-4", workerId === w.id ? "opacity-100" : "opacity-0")}
                        />
                        <span className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                          <span className="font-medium">{`${w.firstName} ${w.lastName}`.trim()}</span>
                          <span className="text-xs text-muted-foreground sm:text-sm">{w.email}</span>
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value || initialMonth)} />
        </CardContent>
      </Card>

      {eventsQuery.isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          {t("admin.common.loading")}
        </div>
      ) : workerId ? (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("admin.timeClock.month_summary_title")}</CardTitle>
              <CardDescription>{t("admin.timeClock.month_total_hours").replace("{{hours}}", totalHours.toFixed(2))}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={daily.map((d) => ({ day: d.dayIso.slice(8), hours: Number((d.workedMinutes / 60).toFixed(2)) }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="hours" fill="#4f46e5" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("admin.timeClock.add_event_title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-[180px_220px_1fr]">
                <Select value={newKind} onValueChange={(v) => setNewKind(v as TimeClockEventKind)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>{t(`admin.timeClock.kind_${k.toLowerCase()}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="datetime-local" value={newAt} onChange={(e) => setNewAt(e.target.value)} />
                <Input
                  value={newKind === "ABSENCE" ? newAbsenceReason : newComment}
                  onChange={(e) =>
                    newKind === "ABSENCE" ? setNewAbsenceReason(e.target.value) : setNewComment(e.target.value)
                  }
                  placeholder={
                    newKind === "ABSENCE"
                      ? t("admin.timeClock.absence_reason_placeholder")
                      : t("admin.timeClock.comment_placeholder")
                  }
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  className="gap-1.5"
                  disabled={createMutation.isPending || !newAt}
                  onClick={() =>
                    createMutation.mutate({
                      eventKind: newKind,
                      eventAt: localInputToIso(newAt),
                      absenceReason: newKind === "ABSENCE" ? newAbsenceReason : undefined,
                      comment: newKind === "ABSENCE" ? "" : newComment,
                    })
                  }
                >
                  <Plus className="h-4 w-4" />
                  {t("admin.timeClock.add_event_action")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("admin.timeClock.events_title")}</CardTitle>
              <CardDescription>{t("admin.timeClock.events_collapsed_hint")}</CardDescription>
            </CardHeader>
            <CardContent className="rounded-md border overflow-x-auto">
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
                    daily.map((day) => {
                      const dayEvents = eventsByDay.get(day.dayIso) ?? [];
                      const expanded = expandedDayIso === day.dayIso;
                      return (
                        <Fragment key={day.dayIso}>
                          <TableRow key={day.dayIso}>
                            <TableCell>{day.dayIso}</TableCell>
                            <TableCell className="text-right tabular-nums">{(day.workedMinutes / 60).toFixed(2)}</TableCell>
                            <TableCell>{day.hasAbsence ? day.absenceReason ?? t("admin.timeClock.state_absent") : "—"}</TableCell>
                            <TableCell className="text-right">{dayEvents.length}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setExpandedDayIso(expanded ? null : day.dayIso)}
                                >
                                  {expanded ? t("admin.timeClock.hide_detail") : t("admin.timeClock.show_detail")}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  disabled={deleteDayMutation.isPending}
                                  onClick={() => {
                                    const ok = window.confirm(
                                      t("admin.timeClock.delete_day_confirm").replace("{{day}}", day.dayIso)
                                    );
                                    if (!ok) return;
                                    deleteDayMutation.mutate(day.dayIso);
                                  }}
                                >
                                  {t("admin.timeClock.delete_day_action")}
                                </Button>
                              </div>
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
                                        <TableHead className="whitespace-nowrap">{t("admin.timeClock.col_clock_in_ip")}</TableHead>
                                        <TableHead>{t("admin.timeClock.col_comment")}</TableHead>
                                        <TableHead className="text-right">{t("admin.common.actions")}</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {dayEvents.map((e) => {
                                        const d = draftById[e.id] ?? {
                                          kind: e.eventKind,
                                          at: toLocalInput(e.eventAt),
                                          comment: e.comment ?? "",
                                          absenceReason: e.absenceReason ?? "",
                                        };
                                        return (
                                          <TableRow key={e.id}>
                                            <TableCell className="min-w-[220px]">
                                              <Input
                                                type="datetime-local"
                                                value={d.at}
                                                onChange={(ev) =>
                                                  setDraftById((prev) => ({ ...prev, [e.id]: { ...d, at: ev.target.value } }))
                                                }
                                              />
                                              <p className="text-[11px] text-muted-foreground mt-1">{formatDt(e.eventAt)}</p>
                                            </TableCell>
                                            <TableCell className="min-w-[180px]">
                                              <Select
                                                value={d.kind}
                                                onValueChange={(v) =>
                                                  setDraftById((prev) => ({ ...prev, [e.id]: { ...d, kind: v as TimeClockEventKind } }))
                                                }
                                              >
                                                <SelectTrigger>
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {EVENT_KINDS.map((k) => (
                                                    <SelectItem key={k} value={k}>
                                                      {t(`admin.timeClock.kind_${k.toLowerCase()}`)}
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                              <Badge variant="outline" className="mt-2">
                                                {e.source}
                                              </Badge>
                                            </TableCell>
                                            <TableCell className="min-w-[140px] align-top text-xs text-muted-foreground tabular-nums">
                                              {e.eventKind === "CLOCK_IN" ? (
                                                e.clockInClientIp ? (
                                                  <span title={t("admin.timeClock.clock_in_ip_hint")}>{e.clockInClientIp}</span>
                                                ) : (
                                                  "—"
                                                )
                                              ) : (
                                                "—"
                                              )}
                                            </TableCell>
                                            <TableCell className="min-w-[280px]">
                                              {d.kind === "ABSENCE" ? (
                                                <Input
                                                  value={d.absenceReason}
                                                  onChange={(ev) =>
                                                    setDraftById((prev) => ({
                                                      ...prev,
                                                      [e.id]: { ...d, absenceReason: ev.target.value },
                                                    }))
                                                  }
                                                  placeholder={t("admin.timeClock.absence_reason_placeholder")}
                                                />
                                              ) : (
                                                <Textarea
                                                  rows={2}
                                                  value={d.comment}
                                                  onChange={(ev) =>
                                                    setDraftById((prev) => ({
                                                      ...prev,
                                                      [e.id]: { ...d, comment: ev.target.value },
                                                    }))
                                                  }
                                                  placeholder={t("admin.timeClock.comment_placeholder")}
                                                />
                                              )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                              <div className="flex items-center justify-end gap-2">
                                                <Button
                                                  type="button"
                                                  size="sm"
                                                  variant="outline"
                                                  className="gap-1.5"
                                                  onClick={() =>
                                                    updateMutation.mutate({
                                                      id: e.id,
                                                      patch: {
                                                        eventKind: d.kind,
                                                        eventAt: localInputToIso(d.at),
                                                        comment: d.comment,
                                                        absenceReason: d.kind === "ABSENCE" ? d.absenceReason : null,
                                                      },
                                                    })
                                                  }
                                                >
                                                  <Save className="h-4 w-4" />
                                                  {t("admin.common.save")}
                                                </Button>
                                                <Button
                                                  type="button"
                                                  size="icon"
                                                  variant="ghost"
                                                  className="text-destructive"
                                                  onClick={() => deleteMutation.mutate(e.id)}
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
                                              </div>
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
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
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t("admin.timeClock.select_worker_hint")}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminTimeClock;
