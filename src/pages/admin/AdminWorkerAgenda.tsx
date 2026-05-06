import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompanyWorkers } from "@/hooks/useCompanyWorkers";
import { useWorkCalendarHolidays } from "@/hooks/useWorkCalendarHolidays";
import { useWorkCalendarSummerDays } from "@/hooks/useWorkCalendarSummerDays";
import { useWorkCalendarSites } from "@/hooks/useWorkCalendarSites";
import { useWorkerVacationDays } from "@/hooks/useWorkerVacationDays";
import { useWorkerAgendaItems } from "@/hooks/useWorkerAgenda";
import { useProjects } from "@/hooks/useProjects";
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
import { createWorkerAgendaItem, deleteWorkerAgendaItem, updateWorkerAgendaItem } from "@/api/workerAgendaApi";
import { useAdminAgendaAuditItems } from "@/hooks/useAdminAgendaAudit";
import { useBackofficeUsers } from "@/hooks/useBackofficeUsers";
import type { WorkCalendarHolidayKind } from "@/types/workCalendars";
import type { WorkerAgendaItemRecord, WorkerAgendaItemType } from "@/types/agenda";
import { ADMIN_WORKER_AGENDA_CREATE_TYPES } from "@/types/agenda";
import { companyWorkerDisplayName } from "@/types/companyWorkers";
import { cn } from "@/lib/utils";
import { isoDateOnlyFromDb } from "@/lib/isoDate";
import { isWeekendIso } from "@/lib/calendarIso";
import {
  agendaAudienceDotClass,
  agendaDetailDialogAccentClass,
  agendaItemChipClass,
  buildAgendaAudienceCountsByIso,
} from "@/lib/workerAgendaAudience";

function toLocalYmd(isoUtc: string): string {
  const d = new Date(isoUtc);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isFridayIso(iso: string): boolean {
  return new Date(iso + "T12:00:00").getDay() === 5;
}

function buildAgendaCountByIso(items: WorkerAgendaItemRecord[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = toLocalYmd(it.startsAt);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

function sortAgendaByTime(items: WorkerAgendaItemRecord[]): WorkerAgendaItemRecord[] {
  return [...items].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

function agendaScopeLine(
  it: WorkerAgendaItemRecord,
  t: (key: string) => string,
  projectTitleById: Map<string, string>,
  workerNameById: Map<string, string>
): string | null {
  if (it.appliesToAllCompanyWorkers) {
    return t("admin.agenda.scope_all_workers_label");
  }
  if (it.projectId) {
    const title = projectTitleById.get(it.projectId) ?? it.projectId;
    return t("admin.agenda.scope_project_label").replace("{{title}}", title);
  }
  if (it.companyWorkerId) {
    const name = workerNameById.get(it.companyWorkerId) ?? "—";
    return t("admin.agenda.scope_worker_label").replace("{{name}}", name);
  }
  return null;
}

function adminAgendaCreatedByLine(
  item: WorkerAgendaItemRecord,
  creatorEmailById: Map<string, string>,
  t: (key: string) => string
): string | null {
  if (item.source !== "ADMIN") return null;
  const cid = item.createdByBackofficeUserId;
  if (!cid) return t("admin.agenda.detail_created_by_unknown");
  const email = creatorEmailById.get(cid);
  if (!email) return t("admin.agenda.detail_created_by_unknown");
  return t("admin.agenda.detail_created_by").replace("{{email}}", email);
}

type AgendaViewMode = "year" | "month" | "week";

type AdminAgendaAudience = "worker" | "all" | "project";

const AdminWorkerAgenda = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: workers = [], isLoading: loadingWorkers } = useCompanyWorkers();
  const activeWorkers = useMemo(() => workers.filter((w) => w.active), [workers]);
  const [workerId, setWorkerId] = useState<string | null>(null);
  const now = new Date();
  const defaultYear = now.getFullYear();
  const [viewMode, setViewMode] = useState<AgendaViewMode>("month");
  const [editYear, setEditYear] = useState(defaultYear);
  const [monthCursor, setMonthCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [weekMonday, setWeekMonday] = useState(() => startOfWeekMonday(now));
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteDate, setNoteDate] = useState(() => dateToLocalYmd(now));
  const [noteTime, setNoteTime] = useState("12:00");
  const [adminAgendaType, setAdminAgendaType] = useState<WorkerAgendaItemType>("note");
  const [agendaAudience, setAgendaAudience] = useState<AdminAgendaAudience>("worker");
  const [agendaProjectId, setAgendaProjectId] = useState<string>("");
  const [detailItem, setDetailItem] = useState<WorkerAgendaItemRecord | null>(null);
  const [detailEditing, setDetailEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("12:00");
  const [editItemType, setEditItemType] = useState<WorkerAgendaItemType>("note");
  const [summaryIso, setSummaryIso] = useState<string | null>(null);

  useEffect(() => {
    setDetailEditing(false);
  }, [detailItem?.id]);

  useEffect(() => {
    if (adminAgendaType === "todo") {
      setAgendaAudience("worker");
      setAgendaProjectId("");
    }
  }, [adminAgendaType]);

  useEffect(() => {
    if (workerId !== null || activeWorkers.length === 0) return;
    setWorkerId(activeWorkers[0]!.id);
  }, [activeWorkers, workerId]);

  useEffect(() => {
    if (!workerId) return;
    const n = new Date();
    setMonthCursor(new Date(n.getFullYear(), n.getMonth(), 1));
    setWeekMonday(startOfWeekMonday(n));
    setEditYear(n.getFullYear());
  }, [workerId]);

  const { data: sites = [] } = useWorkCalendarSites();
  const worker = workerId ? activeWorkers.find((w) => w.id === workerId) : undefined;
  const siteName = worker ? sites.find((s) => s.id === worker.workCalendarSiteId)?.name ?? "" : "";

  const { data: projects = [] } = useProjects();
  const projectTitleById = useMemo(() => new Map(projects.map((p) => [p.id, p.title])), [projects]);

  const workerNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of activeWorkers) m.set(w.id, companyWorkerDisplayName(w));
    return m;
  }, [activeWorkers]);

  const { data: backofficeUsers = [] } = useBackofficeUsers();
  const creatorEmailById = useMemo(() => new Map(backofficeUsers.map((u) => [u.id, u.email])), [backofficeUsers]);

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

  const { data: adminAuditItems = [], isLoading: auditLoad } = useAdminAgendaAuditItems(
    agendaRange.fromIso,
    agendaRange.toIso,
    !!workerId
  );

  const mergedAgendaItems = useMemo(() => {
    const byId = new Map<string, WorkerAgendaItemRecord>();
    for (const it of adminAuditItems) byId.set(it.id, it);
    for (const it of agendaItems) byId.set(it.id, it);
    return sortAgendaByTime([...byId.values()]);
  }, [adminAuditItems, agendaItems]);

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
  const agendaCountByIso = useMemo(() => buildAgendaCountByIso(mergedAgendaItems), [mergedAgendaItems]);
  const agendaAudienceCountsByIso = useMemo(
    () => buildAgendaAudienceCountsByIso(mergedAgendaItems),
    [mergedAgendaItems]
  );
  const agendaAudienceTooltipLabels = useMemo(
    () => ({
      worker: t("admin.agenda.legend_scope_worker"),
      all: t("admin.agenda.legend_scope_all"),
      project: t("admin.agenda.legend_scope_project"),
    }),
    [t, language]
  );
  const itemsByDay = useMemo(() => groupAgendaItemsByLocalDay(mergedAgendaItems), [mergedAgendaItems]);

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

  const calendarLoading =
    !workerId || hLoadA || hLoadB || sLoadA || sLoadB || vLoadA || vLoadB || aLoad || auditLoad;

  const noteMutation = useMutation({
    mutationFn: async () => {
      if (agendaAudience === "worker" && !workerId) throw new Error("worker");
      if (agendaAudience === "project" && !agendaProjectId) throw new Error("project");
      const [hh, mm] = noteTime.split(":").map(Number);
      const start = new Date(noteDate + "T12:00:00");
      start.setHours(hh, mm, 0, 0);
      if (agendaAudience === "all") {
        return createWorkerAgendaItem({
          appliesToAllCompanyWorkers: true,
          title: noteTitle.trim(),
          description: noteBody.trim() || null,
          startsAt: start.toISOString(),
          endsAt: null,
          itemType: adminAgendaType,
        });
      }
      if (agendaAudience === "project") {
        return createWorkerAgendaItem({
          projectId: agendaProjectId,
          title: noteTitle.trim(),
          description: noteBody.trim() || null,
          startsAt: start.toISOString(),
          endsAt: null,
          itemType: adminAgendaType,
        });
      }
      return createWorkerAgendaItem({
        companyWorkerId: workerId!,
        title: noteTitle.trim(),
        description: noteBody.trim() || null,
        startsAt: start.toISOString(),
        endsAt: null,
        itemType: adminAgendaType,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workerAgendaItems"] });
      await queryClient.invalidateQueries({ queryKey: ["adminAgendaAuditItems"] });
      toast({ title: t("admin.agenda.toast_saved") });
      setNoteTitle("");
      setNoteBody("");
      setAgendaAudience("worker");
      setAgendaProjectId("");
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

  const adminDeleteMutation = useMutation({
    mutationFn: (id: string) => deleteWorkerAgendaItem(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workerAgendaItems"] });
      await queryClient.invalidateQueries({ queryKey: ["adminAgendaAuditItems"] });
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

  const adminUpdateMutation = useMutation({
    mutationFn: async () => {
      if (!detailItem) throw new Error("no item");
      const [hh, mm] = editTime.split(":").map(Number);
      const start = new Date(editDate + "T12:00:00");
      start.setHours(hh, mm, 0, 0);
      return updateWorkerAgendaItem(detailItem.id, {
        title: editTitle.trim(),
        description: editBody.trim() || null,
        startsAt: start.toISOString(),
        itemType: editItemType,
      });
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["workerAgendaItems"] });
      await queryClient.invalidateQueries({ queryKey: ["adminAgendaAuditItems"] });
      setDetailItem(data);
      setDetailEditing(false);
      toast({ title: t("admin.agenda.toast_updated") });
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

  const startDetailEdit = () => {
    if (!detailItem) return;
    setEditTitle(detailItem.title);
    setEditBody(detailItem.description ?? "");
    const d = new Date(detailItem.startsAt);
    setEditDate(dateToLocalYmd(d));
    setEditTime(
      `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    );
    let nextType = detailItem.itemType;
    if (
      (detailItem.appliesToAllCompanyWorkers || detailItem.projectId) &&
      nextType === "todo"
    ) {
      nextType = "note";
    }
    setEditItemType(nextType);
    setDetailEditing(true);
  };

  const detailEditTypeOptions = useMemo(() => {
    if (!detailItem) return ADMIN_WORKER_AGENDA_CREATE_TYPES;
    const skipTodo = detailItem.appliesToAllCompanyWorkers || !!detailItem.projectId;
    return ADMIN_WORKER_AGENDA_CREATE_TYPES.filter((k) => !skipTodo || k !== "todo");
  }, [detailItem]);

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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <CalendarDays className="h-7 w-7 text-primary" aria-hidden />
          {t("admin.agenda.admin_title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.agenda.admin_subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.agenda.field_audience")}</CardTitle>
          <CardDescription>{t("admin.agenda.audience_card_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-xl">
          {loadingWorkers ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <>
              <RadioGroup
                value={agendaAudience}
                onValueChange={(v) => {
                  const next = v as AdminAgendaAudience;
                  setAgendaAudience(next);
                  if (next !== "project") setAgendaProjectId("");
                }}
                className="grid gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="worker" id="ag-aud-worker" className="mt-0.5" />
                    <Label htmlFor="ag-aud-worker" className="cursor-pointer font-normal leading-snug">
                      {t("admin.agenda.audience_worker")}
                    </Label>
                  </div>
                  {agendaAudience === "worker" ? (
                    <div className="ml-7 space-y-2 rounded-md border bg-muted/20 p-3 max-w-md">
                      <Label>{t("admin.agenda.admin_select_worker")}</Label>
                      <SearchableSelect
                        value={workerId ?? ""}
                        onValueChange={(v) => setWorkerId(v || null)}
                        options={activeWorkers.map((w) => ({
                          value: w.id,
                          label: companyWorkerDisplayName(w),
                        }))}
                        placeholder={t("admin.agenda.admin_select_placeholder")}
                        className="max-w-full"
                      />
                    </div>
                  ) : null}
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem
                    value="all"
                    id="ag-aud-all"
                    className="mt-0.5"
                    disabled={adminAgendaType === "todo"}
                  />
                  <Label htmlFor="ag-aud-all" className="cursor-pointer font-normal leading-snug">
                    {t("admin.agenda.audience_all")}
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem
                    value="project"
                    id="ag-aud-proj"
                    className="mt-0.5"
                    disabled={adminAgendaType === "todo"}
                  />
                  <Label htmlFor="ag-aud-proj" className="cursor-pointer font-normal leading-snug">
                    {t("admin.agenda.audience_project")}
                  </Label>
                </div>
              </RadioGroup>

              {agendaAudience === "project" ? (
                <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                  <Label>{t("admin.agenda.field_project")}</Label>
                  <SearchableSelect
                    value={agendaProjectId}
                    onValueChange={(v) => setAgendaProjectId(v)}
                    options={projects.map((p) => ({ value: p.id, label: p.title }))}
                    placeholder={t("admin.agenda.field_project")}
                    className="max-w-md"
                  />
                  <p className="text-xs text-muted-foreground">{t("admin.agenda.field_project_hint")}</p>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {workerId ? (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("admin.agenda.admin_entry_title")}</CardTitle>
              <CardDescription>{t("admin.agenda.admin_entry_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-w-xl">
              <div className="space-y-2">
                <Label>{t("admin.agenda.field_type")}</Label>
                <SearchableSelect
                  value={adminAgendaType}
                  onValueChange={(v) => setAdminAgendaType(v as WorkerAgendaItemType)}
                  options={ADMIN_WORKER_AGENDA_CREATE_TYPES.map((k) => ({
                    value: k,
                    label: t(`admin.agenda.type_${k}`),
                  }))}
                  searchable={false}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.agenda.field_title")}</Label>
                <Input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.agenda.field_description")}</Label>
                <Textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>{t("admin.agenda.field_date")}</Label>
                  <Input
                    type="date"
                    value={noteDate}
                    onChange={(e) => setNoteDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("admin.agenda.field_time")}</Label>
                  <Input type="time" value={noteTime} onChange={(e) => setNoteTime(e.target.value)} />
                </div>
              </div>
              <Button
                type="button"
                className="gap-2"
                disabled={
                  !noteTitle.trim() ||
                  !noteDate ||
                  noteMutation.isPending ||
                  (agendaAudience === "worker" && !workerId) ||
                  (agendaAudience === "project" && !agendaProjectId)
                }
                onClick={() => noteMutation.mutate()}
              >
                {noteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t("admin.agenda.admin_entry_submit")}
              </Button>
            </CardContent>
          </Card>

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
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("admin.agenda.grid_title")}</CardTitle>
              <CardDescription>{t("admin.agenda.grid_desc")}</CardDescription>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className={agendaAudienceDotClass("worker")} aria-hidden />
                  {t("admin.agenda.legend_scope_worker")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className={agendaAudienceDotClass("all")} aria-hidden />
                  {t("admin.agenda.legend_scope_all")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className={agendaAudienceDotClass("project")} aria-hidden />
                  {t("admin.agenda.legend_scope_project")}
                </span>
              </div>
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
                  agendaAudienceCountsByIso={agendaAudienceCountsByIso}
                  agendaAudienceTooltipLabels={agendaAudienceTooltipLabels}
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

          <Dialog
            open={!!detailItem}
            onOpenChange={(open) => {
              if (!open) {
                setDetailItem(null);
                setDetailEditing(false);
              }
            }}
          >
            <DialogContent
              className={cn(
                "max-w-md sm:max-w-lg",
                detailItem ? agendaDetailDialogAccentClass(detailItem) : undefined
              )}
            >
              {detailItem ? (
                <>
                  <DialogHeader>
                    <DialogTitle className="pr-8">
                      {detailEditing ? t("admin.agenda.detail_edit_title") : detailItem.title}
                    </DialogTitle>
                  </DialogHeader>
                  {detailEditing ? (
                    <div className="space-y-3 py-1">
                      <p className="text-xs text-muted-foreground">{t("admin.agenda.detail_edit_scope_hint")}</p>
                      <div className="space-y-2">
                        <Label>{t("admin.agenda.field_type")}</Label>
                        <SearchableSelect
                          value={editItemType}
                          onValueChange={(v) => setEditItemType(v as WorkerAgendaItemType)}
                          options={detailEditTypeOptions.map((k) => ({
                            value: k,
                            label: t(`admin.agenda.type_${k}`),
                          }))}
                          searchable={false}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("admin.agenda.field_title")}</Label>
                        <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("admin.agenda.field_description")}</Label>
                        <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={4} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label>{t("admin.agenda.field_date")}</Label>
                          <Input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("admin.agenda.field_time")}</Label>
                          <Input
                            type="time"
                            value={editTime}
                            onChange={(e) => setEditTime(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 py-1">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{t(`admin.agenda.type_${detailItem.itemType}`)}</Badge>
                        {detailItem.source === "ADMIN" ? (
                          <Badge variant="secondary">{t("admin.agenda.badge_admin")}</Badge>
                        ) : null}
                        {detailItem.appliesToAllCompanyWorkers ? (
                          <Badge className="bg-sky-700 hover:bg-sky-700">
                            {t("admin.agenda.badge_all_workers")}
                          </Badge>
                        ) : null}
                        {detailItem.projectId ? (
                          <Badge className="bg-amber-800 hover:bg-amber-800">
                            {t("admin.agenda.badge_project")}
                            {projectTitleById.get(detailItem.projectId)
                              ? `: ${projectTitleById.get(detailItem.projectId)}`
                              : ""}
                          </Badge>
                        ) : null}
                      </div>
                      {(() => {
                        const s = agendaScopeLine(detailItem, t, projectTitleById, workerNameById);
                        return s ? <p className="text-sm text-muted-foreground">{s}</p> : null;
                      })()}
                      {(() => {
                        const line = adminAgendaCreatedByLine(detailItem, creatorEmailById, t);
                        return line ? <p className="text-xs text-muted-foreground">{line}</p> : null;
                      })()}
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
                  )}
                  <DialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                    {detailEditing ? (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full sm:w-auto"
                          disabled={adminUpdateMutation.isPending}
                          onClick={() => setDetailEditing(false)}
                        >
                          {t("admin.agenda.detail_cancel_edit")}
                        </Button>
                        <Button
                          type="button"
                          className="w-full sm:w-auto gap-2"
                          disabled={
                            !editTitle.trim() ||
                            !editDate ||
                            adminUpdateMutation.isPending
                          }
                          onClick={() => adminUpdateMutation.mutate()}
                        >
                          {adminUpdateMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : null}
                          {t("admin.agenda.detail_save")}
                        </Button>
                      </>
                    ) : (
                      <>
                        {detailItem.source === "ADMIN" ? (
                          <Button
                            type="button"
                            variant="destructive"
                            className="w-full sm:w-auto mr-auto gap-2"
                            disabled={adminDeleteMutation.isPending}
                            onClick={() => {
                              if (window.confirm(t("admin.agenda.delete_confirm"))) {
                                adminDeleteMutation.mutate(detailItem.id);
                              }
                            }}
                          >
                            {adminDeleteMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            {t("admin.agenda.delete_admin_entry")}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full sm:w-auto gap-2"
                          onClick={startDetailEdit}
                        >
                          <Pencil className="h-4 w-4" />
                          {t("admin.agenda.detail_edit")}
                        </Button>
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
                            className={cn(
                              "w-full min-w-0 text-left transition-colors",
                              agendaItemChipClass(it, "comfortable")
                            )}
                            onClick={() => {
                              setSummaryIso(null);
                              setDetailItem(it);
                            }}
                          >
                            <div className="min-w-0">
                              <div>
                                <span className="font-medium">{it.title}</span>
                                <span className="ml-2 text-xs opacity-80">
                                  {new Date(it.startsAt).toLocaleTimeString(dateLocale, {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              {it.description ? (
                                <p className="mt-1 line-clamp-3 text-xs opacity-80 whitespace-pre-wrap">
                                  {it.description}
                                </p>
                              ) : null}
                            </div>
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
        </>
      ) : null}
    </div>
  );
};

export default AdminWorkerAgenda;
