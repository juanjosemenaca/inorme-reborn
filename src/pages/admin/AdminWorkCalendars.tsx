import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Upload,
} from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useWorkCalendarHolidays } from "@/hooks/useWorkCalendarHolidays";
import { useWorkCalendarSummerDays } from "@/hooks/useWorkCalendarSummerDays";
import { useWorkCalendarSites } from "@/hooks/useWorkCalendarSites";
import {
  bulkImportWorkCalendarHolidays,
  bulkImportWorkCalendarSummerRanges,
  createWorkCalendarHoliday,
  createWorkCalendarSummerRange,
  deleteWorkCalendarHoliday,
  deleteWorkCalendarSummerRange,
  parseHolidayImportLines,
  parseSummerRangeImportLines,
  updateWorkCalendarHoliday,
  updateWorkCalendarSummerRange,
} from "@/api/workCalendarsApi";
import {
  createWorkCalendarSiteFromBarcelona,
  deleteWorkCalendarSite,
  updateWorkCalendarSite,
} from "@/api/workCalendarSitesApi";
import { queryKeys } from "@/lib/queryKeys";
import type {
  WorkCalendarHolidayKind,
  WorkCalendarHolidayRecord,
  WorkCalendarSiteRecord,
  WorkCalendarSummerRangeRecord,
} from "@/types/workCalendars";
import { WORK_CALENDAR_HOLIDAY_KINDS } from "@/types/workCalendars";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorMessage";
import { WorkCalendarYearGrid } from "@/components/admin/WorkCalendarYearGrid";
import { expandSummerRangesToWeekdayIsoSet } from "@/lib/workCalendarSummerRange";

const holidayFormSchema = z.object({
  holidayDate: z
    .string()
    .trim()
    .min(1, "Fecha obligatoria")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha no válido"),
  holidayKind: z.enum(["NACIONAL", "AUTONOMICO", "LOCAL"]),
  label: z.string().optional(),
});

type HolidayFormValues = z.infer<typeof holidayFormSchema>;

const summerFormSchema = z
  .object({
    dateStart: z.string().min(1, "Fecha obligatoria"),
    dateEnd: z.string().min(1, "Fecha obligatoria"),
    label: z.string().optional(),
  })
  .refine((d) => d.dateStart <= d.dateEnd, { message: "La fecha fin debe ser igual o posterior al inicio", path: ["dateEnd"] });

type SummerFormValues = z.infer<typeof summerFormSchema>;

const AdminWorkCalendars = () => {
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const { data: sites = [], isLoading: sitesLoading } = useWorkCalendarSites();

  const { data: holidays = [], isLoading: holidaysLoading, isError: holidaysError, error: holidaysErr } =
    useWorkCalendarHolidays(year);
  const { data: summerDays = [], isLoading: summerLoading, isError: summerError, error: summerErr } =
    useWorkCalendarSummerDays(year);

  useEffect(() => {
    if (sites.length === 0) return;
    if (!selectedSiteId || !sites.some((s) => s.id === selectedSiteId)) {
      setSelectedSiteId(sites[0].id);
    }
  }, [sites, selectedSiteId]);

  const isLoading = sitesLoading || holidaysLoading || summerLoading;
  const isError = holidaysError || summerError;
  const error = holidaysErr ?? summerErr;

  const bySite = useMemo(() => {
    const m = new Map<string, WorkCalendarHolidayRecord[]>();
    for (const h of holidays) {
      const list = m.get(h.siteId) ?? [];
      list.push(h);
      m.set(h.siteId, list);
    }
    return m;
  }, [holidays]);

  const bySiteSummer = useMemo(() => {
    const m = new Map<string, WorkCalendarSummerRangeRecord[]>();
    for (const d of summerDays) {
      const list = m.get(d.siteId) ?? [];
      list.push(d);
      m.set(d.siteId, list);
    }
    return m;
  }, [summerDays]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<WorkCalendarHolidayRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkCalendarHolidayRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [summerDialogOpen, setSummerDialogOpen] = useState(false);
  const [summerMode, setSummerMode] = useState<"create" | "edit">("create");
  const [editingSummer, setEditingSummer] = useState<WorkCalendarSummerRangeRecord | null>(null);
  const [summerDeleteTarget, setSummerDeleteTarget] = useState<WorkCalendarSummerRangeRecord | null>(null);
  const [summerImportOpen, setSummerImportOpen] = useState(false);
  const [summerImportText, setSummerImportText] = useState("");
  const [newSiteOpen, setNewSiteOpen] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteVacation, setNewSiteVacation] = useState(22);
  const [editSiteOpen, setEditSiteOpen] = useState(false);
  const [editSiteTarget, setEditSiteTarget] = useState<WorkCalendarSiteRecord | null>(null);
  const [editSiteName, setEditSiteName] = useState("");
  const [editSiteVacation, setEditSiteVacation] = useState(22);
  const [deleteSiteTarget, setDeleteSiteTarget] = useState<WorkCalendarSiteRecord | null>(null);

  const form = useForm<HolidayFormValues>({
    resolver: zodResolver(holidayFormSchema),
    defaultValues: { holidayDate: "", holidayKind: "NACIONAL", label: "" },
  });

  const summerForm = useForm<SummerFormValues>({
    resolver: zodResolver(summerFormSchema),
    defaultValues: { dateStart: "", dateEnd: "", label: "" },
  });

  const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? id;

  const kindLabel = (k: WorkCalendarHolidayKind) => t(`admin.workCalendars.kind_${k}`);

  const dateLocale = language === "ca" ? "ca-ES" : language === "en" ? "en-GB" : "es-ES";

  const formatDisplayDate = (iso: string) => {
    try {
      const d = new Date(iso + "T12:00:00");
      return d.toLocaleDateString(dateLocale, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    } catch {
      return iso;
    }
  };

  const openCreate = (siteId: string) => {
    setSelectedSiteId(siteId);
    setDialogMode("create");
    setEditing(null);
    form.reset({ holidayDate: `${year}-01-01`, holidayKind: "NACIONAL", label: "" });
    setDialogOpen(true);
  };

  const openEdit = (h: WorkCalendarHolidayRecord) => {
    setSelectedSiteId(h.siteId);
    setDialogMode("edit");
    setEditing(h);
    form.reset({ holidayDate: h.holidayDate, holidayKind: h.holidayKind, label: h.label });
    setDialogOpen(true);
  };

  const onSubmitHoliday = form.handleSubmit(async (values) => {
    try {
      if (dialogMode === "create") {
        await createWorkCalendarHoliday({
          calendarYear: year,
          siteId: selectedSiteId,
          holidayDate: values.holidayDate,
          holidayKind: values.holidayKind,
          label: values.label ?? "",
        });
        toast({ title: t("admin.workCalendars.toast_created") });
      } else if (editing) {
        await updateWorkCalendarHoliday(editing.id, {
          holidayDate: values.holidayDate,
          holidayKind: values.holidayKind,
          label: values.label ?? "",
        });
        toast({ title: t("admin.workCalendars.toast_updated") });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.workCalendarHolidays(year) });
      setDialogOpen(false);
    } catch (e) {
      const raw = getErrorMessage(e);
      const dup = /duplicate|unique|23505/i.test(raw);
      toast({
        title: t("admin.common.error"),
        description: dup ? t("admin.workCalendars.error_duplicate_holiday") : raw,
        variant: "destructive",
      });
    }
  });

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteWorkCalendarHoliday(deleteTarget.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.workCalendarHolidays(year) });
      toast({ title: t("admin.workCalendars.toast_deleted") });
      setDeleteTarget(null);
    } catch (e) {
      toast({
        title: t("admin.common.error"),
        description: getErrorMessage(e),
        variant: "destructive",
      });
    }
  };

  const runImport = async () => {
    const rows = parseHolidayImportLines(importText);
    if (rows.length === 0) {
      toast({
        title: t("admin.common.error"),
        description: t("admin.workCalendars.import_empty"),
        variant: "destructive",
      });
      return;
    }
    try {
      const { inserted, skipped } = await bulkImportWorkCalendarHolidays(year, selectedSiteId, rows);
      await queryClient.invalidateQueries({ queryKey: queryKeys.workCalendarHolidays(year) });
      toast({
        title: t("admin.workCalendars.import_done"),
        description: `${t("admin.workCalendars.import_inserted")}: ${inserted}. ${t("admin.workCalendars.import_skipped")}: ${skipped}.`,
      });
      setImportText("");
      setImportOpen(false);
    } catch (e) {
      toast({
        title: t("admin.common.error"),
        description: getErrorMessage(e),
        variant: "destructive",
      });
    }
  };

  const openCreateSummer = (siteId: string) => {
    setSelectedSiteId(siteId);
    setSummerMode("create");
    setEditingSummer(null);
    summerForm.reset({ dateStart: `${year}-07-01`, dateEnd: `${year}-08-31`, label: "" });
    setSummerDialogOpen(true);
  };

  const openEditSummer = (row: WorkCalendarSummerRangeRecord) => {
    setSelectedSiteId(row.siteId);
    setSummerMode("edit");
    setEditingSummer(row);
    summerForm.reset({ dateStart: row.dateStart, dateEnd: row.dateEnd, label: row.label });
    setSummerDialogOpen(true);
  };

  const onSubmitSummer = summerForm.handleSubmit(async (values) => {
    try {
      if (summerMode === "create") {
        await createWorkCalendarSummerRange({
          calendarYear: year,
          siteId: selectedSiteId,
          dateStart: values.dateStart,
          dateEnd: values.dateEnd,
          label: values.label ?? "",
        });
        toast({ title: t("admin.workCalendars.summer_toast_created") });
      } else if (editingSummer) {
        await updateWorkCalendarSummerRange(editingSummer.id, {
          dateStart: values.dateStart,
          dateEnd: values.dateEnd,
          label: values.label ?? "",
        });
        toast({ title: t("admin.workCalendars.summer_toast_updated") });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.workCalendarSummerDays(year) });
      setSummerDialogOpen(false);
    } catch (e) {
      toast({
        title: t("admin.common.error"),
        description: getErrorMessage(e),
        variant: "destructive",
      });
    }
  });

  const confirmDeleteSummer = async () => {
    if (!summerDeleteTarget) return;
    try {
      await deleteWorkCalendarSummerRange(summerDeleteTarget.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.workCalendarSummerDays(year) });
      toast({ title: t("admin.workCalendars.summer_toast_deleted") });
      setSummerDeleteTarget(null);
    } catch (e) {
      toast({
        title: t("admin.common.error"),
        description: getErrorMessage(e),
        variant: "destructive",
      });
    }
  };

  const runSummerImport = async () => {
    const ranges = parseSummerRangeImportLines(summerImportText);
    if (ranges.length === 0) {
      toast({
        title: t("admin.common.error"),
        description: t("admin.workCalendars.import_empty"),
        variant: "destructive",
      });
      return;
    }
    try {
      const { inserted, skipped } = await bulkImportWorkCalendarSummerRanges(year, selectedSiteId, ranges);
      await queryClient.invalidateQueries({ queryKey: queryKeys.workCalendarSummerDays(year) });
      toast({
        title: t("admin.workCalendars.import_done"),
        description: `${t("admin.workCalendars.import_inserted")}: ${inserted}. ${t("admin.workCalendars.import_skipped")}: ${skipped}.`,
      });
      setSummerImportText("");
      setSummerImportOpen(false);
    } catch (e) {
      toast({
        title: t("admin.common.error"),
        description: getErrorMessage(e),
        variant: "destructive",
      });
    }
  };

  const createSiteMutation = useMutation({
    mutationFn: () =>
      createWorkCalendarSiteFromBarcelona({
        name: newSiteName,
        vacationDaysDefault: newSiteVacation,
      }),
    onSuccess: async (created) => {
      toast({ title: t("admin.workCalendars.sites_toast_created") });
      await queryClient.invalidateQueries({ queryKey: queryKeys.workCalendarSites });
      await queryClient.invalidateQueries({ queryKey: queryKeys.workCalendarHolidays(year) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.workCalendarSummerDays(year) });
      setSelectedSiteId(created.id);
      setNewSiteOpen(false);
      setNewSiteName("");
      setNewSiteVacation(22);
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: getErrorMessage(e),
        variant: "destructive",
      });
    },
  });

  const updateSiteMutation = useMutation({
    mutationFn: async () => {
      if (!editSiteTarget) throw new Error("Sede no seleccionada.");
      return updateWorkCalendarSite(editSiteTarget.id, {
        name: editSiteName,
        vacationDaysDefault: editSiteVacation,
      });
    },
    onSuccess: async () => {
      toast({ title: t("admin.workCalendars.sites_toast_updated") });
      await queryClient.invalidateQueries({ queryKey: queryKeys.workCalendarSites });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companyWorkers });
      await queryClient.invalidateQueries({ queryKey: ["adminVacationSummaries"] });
      await queryClient.refetchQueries({ queryKey: ["adminVacationSummaries"] });
      setEditSiteOpen(false);
      setEditSiteTarget(null);
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: getErrorMessage(e),
        variant: "destructive",
      });
    },
  });

  const deleteSiteMutation = useMutation({
    mutationFn: (id: string) => deleteWorkCalendarSite(id),
    onSuccess: async () => {
      toast({ title: t("admin.workCalendars.sites_toast_deleted") });
      await queryClient.invalidateQueries({ queryKey: queryKeys.workCalendarSites });
      setDeleteSiteTarget(null);
      setSelectedSiteId("");
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: getErrorMessage(e),
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
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm space-y-2">
        <p className="font-medium text-destructive">{t("admin.workCalendars.load_error")}</p>
        <p className="text-muted-foreground break-words">{getErrorMessage(error)}</p>
        <p className="text-xs text-muted-foreground">{t("admin.workCalendars.load_hint")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-7 w-7 text-primary" />
            {t("admin.workCalendars.title")}
          </h2>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">{t("admin.workCalendars.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground whitespace-nowrap">{t("admin.workCalendars.year")}</label>
            <Input
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
          <CardTitle className="text-base">{t("admin.workCalendars.sites_card_title")}</CardTitle>
          <CardDescription>{t("admin.workCalendars.sites_card_desc")}</CardDescription>
        </CardHeader>
        <div className="px-6 pb-4 flex flex-wrap gap-2 items-center">
          <Button type="button" variant="secondary" size="sm" className="gap-1" onClick={() => setNewSiteOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("admin.workCalendars.sites_new")}
          </Button>
          {selectedSiteId && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const st = sites.find((x) => x.id === selectedSiteId);
                  if (st) {
                    setEditSiteTarget(st);
                    setEditSiteName(st.name);
                    setEditSiteVacation(st.vacationDaysDefault);
                    setEditSiteOpen(true);
                  }
                }}
              >
                {t("admin.workCalendars.sites_edit")}
              </Button>
              {sites.find((x) => x.id === selectedSiteId) && !sites.find((x) => x.id === selectedSiteId)?.isSystem && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  onClick={() => {
                    const st = sites.find((x) => x.id === selectedSiteId);
                    if (st) setDeleteSiteTarget(st);
                  }}
                >
                  {t("admin.workCalendars.sites_delete")}
                </Button>
              )}
            </>
          )}
        </div>
      </Card>

      <Tabs value={selectedSiteId} onValueChange={setSelectedSiteId} className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1 w-full sm:w-auto justify-start">
          {sites.map((s) => (
            <TabsTrigger key={s.id} value={s.id} className="text-xs sm:text-sm">
              {s.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {sites.map((s) => {
          const rows = bySite.get(s.id) ?? [];
          const summerRows = bySiteSummer.get(s.id) ?? [];
          const { isoSet: summerIsoSet, labelByIso: summerLabelByIso } = expandSummerRangesToWeekdayIsoSet(
            summerRows.map((r) => ({
              dateStart: r.dateStart,
              dateEnd: r.dateEnd,
              label: r.label,
            }))
          );
          return (
            <TabsContent key={s.id} value={s.id} className="mt-0 space-y-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t("admin.workCalendars.card_title")}</CardTitle>
                  <CardDescription>{t("admin.workCalendars.card_desc")}</CardDescription>
                </CardHeader>
                <div className="px-6 pb-6 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="gap-1.5" onClick={() => openCreate(s.id)}>
                      <Plus className="h-4 w-4" />
                      {t("admin.workCalendars.add_day")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => {
                        setScope(s);
                        setImportOpen(true);
                      }}
                    >
                      <Upload className="h-4 w-4" />
                      {t("admin.workCalendars.import_csv")}
                    </Button>
                  </div>
                  <div className="rounded-md border overflow-x-auto">
                    {rows.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-8 text-center px-4">{t("admin.workCalendars.empty")}</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("admin.workCalendars.col_date")}</TableHead>
                            <TableHead>{t("admin.workCalendars.col_kind")}</TableHead>
                            <TableHead>{t("admin.workCalendars.col_label")}</TableHead>
                            <TableHead className="text-right w-[100px]">{t("admin.common.actions")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((h) => (
                            <TableRow key={h.id}>
                              <TableCell className="font-medium tabular-nums">{formatDisplayDate(h.holidayDate)}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">{kindLabel(h.holidayKind)}</TableCell>
                              <TableCell className="text-muted-foreground">{h.label || "—"}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(h)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => setDeleteTarget(h)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t("admin.workCalendars.summer_card_title")}</CardTitle>
                  <CardDescription>{t("admin.workCalendars.summer_card_desc")}</CardDescription>
                </CardHeader>
                <div className="px-6 pb-6 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="gap-1.5" variant="secondary" onClick={() => openCreateSummer(s.id)}>
                      <Plus className="h-4 w-4" />
                      {t("admin.workCalendars.summer_add")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => {
                        setScope(s);
                        setSummerImportOpen(true);
                      }}
                    >
                      <Upload className="h-4 w-4" />
                      {t("admin.workCalendars.summer_import")}
                    </Button>
                  </div>
                  <div className="rounded-md border overflow-x-auto">
                    {summerRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-8 text-center px-4">
                        {t("admin.workCalendars.summer_empty")}
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("admin.workCalendars.summer_col_start")}</TableHead>
                            <TableHead>{t("admin.workCalendars.summer_col_end")}</TableHead>
                            <TableHead>{t("admin.workCalendars.summer_col_label")}</TableHead>
                            <TableHead className="text-right w-[100px]">{t("admin.common.actions")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {summerRows.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="font-medium tabular-nums">{formatDisplayDate(row.dateStart)}</TableCell>
                              <TableCell className="font-medium tabular-nums">{formatDisplayDate(row.dateEnd)}</TableCell>
                              <TableCell className="text-muted-foreground">{row.label || "—"}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditSummer(row)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => setSummerDeleteTarget(row)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t("admin.workCalendars.year_view_title")}</CardTitle>
                  <CardDescription>{t("admin.workCalendars.year_view_desc")}</CardDescription>
                </CardHeader>
                <div className="px-6 pb-6">
                  <WorkCalendarYearGrid
                    year={year}
                    holidays={rows}
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
                  />
                </div>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? t("admin.workCalendars.dialog_create") : t("admin.workCalendars.dialog_edit")}
            </DialogTitle>
            <DialogDescription>
              {siteName(selectedSiteId)} · {year}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={onSubmitHoliday} className="space-y-4">
              <FormField
                control={form.control}
                name="holidayDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.workCalendars.field_date")}</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        min={`${(editing?.calendarYear ?? year)}-01-01`}
                        max={`${(editing?.calendarYear ?? year)}-12-31`}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="holidayKind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.workCalendars.field_kind")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("admin.workCalendars.field_kind")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {WORK_CALENDAR_HOLIDAY_KINDS.map((k) => (
                          <SelectItem key={k} value={k}>
                            {kindLabel(k)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.workCalendars.field_label")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("admin.workCalendars.label_ph")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  {t("admin.common.cancel")}
                </Button>
                <Button type="submit">{t("admin.common.save")}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("admin.workCalendars.import_title")}</DialogTitle>
            <DialogDescription className="whitespace-pre-line">{t("admin.workCalendars.import_help")}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={10}
            className="font-mono text-sm"
            placeholder={t("admin.workCalendars.import_placeholder")}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
              {t("admin.common.cancel")}
            </Button>
            <Button type="button" onClick={() => void runImport()}>
              {t("admin.workCalendars.import_run")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={summerDialogOpen} onOpenChange={setSummerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {summerMode === "create"
                ? t("admin.workCalendars.summer_dialog_create")
                : t("admin.workCalendars.summer_dialog_edit")}
            </DialogTitle>
            <DialogDescription>
              {siteName(selectedSiteId)} · {year}
            </DialogDescription>
          </DialogHeader>
          <Form {...summerForm}>
            <form onSubmit={onSubmitSummer} className="space-y-4">
              <FormField
                control={summerForm.control}
                name="dateStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.workCalendars.summer_field_date_start")}</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        min={`${year}-01-01`}
                        max={`${year}-12-31`}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={summerForm.control}
                name="dateEnd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.workCalendars.summer_field_date_end")}</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        min={`${year}-01-01`}
                        max={`${year}-12-31`}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={summerForm.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.workCalendars.summer_field_label")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("admin.workCalendars.summer_label_ph")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSummerDialogOpen(false)}>
                  {t("admin.common.cancel")}
                </Button>
                <Button type="submit">{t("admin.common.save")}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={summerImportOpen} onOpenChange={setSummerImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("admin.workCalendars.summer_import_title")}</DialogTitle>
            <DialogDescription className="whitespace-pre-line">{t("admin.workCalendars.summer_import_help")}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={summerImportText}
            onChange={(e) => setSummerImportText(e.target.value)}
            rows={10}
            className="font-mono text-sm"
            placeholder={t("admin.workCalendars.summer_import_placeholder")}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSummerImportOpen(false)}>
              {t("admin.common.cancel")}
            </Button>
            <Button type="button" onClick={() => void runSummerImport()}>
              {t("admin.workCalendars.import_run")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newSiteOpen} onOpenChange={setNewSiteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.workCalendars.sites_new_title")}</DialogTitle>
            <DialogDescription>{t("admin.workCalendars.sites_new_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("admin.workCalendars.sites_new_name")}</label>
              <Input value={newSiteName} onChange={(e) => setNewSiteName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("admin.workCalendars.sites_new_vacation")}</label>
              <Input
                type="number"
                min={0}
                max={365}
                value={newSiteVacation}
                onChange={(e) => setNewSiteVacation(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewSiteOpen(false)}>
              {t("admin.common.cancel")}
            </Button>
            <Button
              type="button"
              disabled={!newSiteName.trim() || createSiteMutation.isPending}
              onClick={() => createSiteMutation.mutate()}
            >
              {createSiteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("admin.workCalendars.sites_new_submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editSiteOpen} onOpenChange={setEditSiteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.workCalendars.sites_edit_title")}</DialogTitle>
            <DialogDescription>{t("admin.workCalendars.sites_edit_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("admin.workCalendars.sites_new_name")}</label>
              <Input value={editSiteName} onChange={(e) => setEditSiteName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("admin.workCalendars.sites_edit_vacation_default")}</label>
              <Input
                type="number"
                min={0}
                max={365}
                value={editSiteVacation}
                onChange={(e) => setEditSiteVacation(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">{t("admin.workCalendars.sites_edit_vacation_sync_hint")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditSiteOpen(false)}>
              {t("admin.common.cancel")}
            </Button>
            <Button
              type="button"
              disabled={!editSiteName.trim() || updateSiteMutation.isPending}
              onClick={() => {
                if (!editSiteTarget) return;
                updateSiteMutation.mutate();
              }}
            >
              {updateSiteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("admin.common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteSiteTarget} onOpenChange={() => setDeleteSiteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.workCalendars.sites_delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.workCalendars.sites_delete_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteSiteTarget && deleteSiteMutation.mutate(deleteSiteTarget.id)}
            >
              {t("admin.common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.workCalendars.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.workCalendars.delete_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              {t("admin.common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!summerDeleteTarget} onOpenChange={() => setSummerDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.workCalendars.summer_delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.workCalendars.summer_delete_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDeleteSummer()}
            >
              {t("admin.common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminWorkCalendars;
