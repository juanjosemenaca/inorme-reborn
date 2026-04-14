import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Euro, Loader2, Save, Send } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useWorkerExpenseSheets } from "@/hooks/useWorkerExpenseSheets";
import { queryKeys } from "@/lib/queryKeys";
import {
  computeLineTotal,
  computeSheetTotal,
  deleteExpenseSheetAttachment,
  getOrCreateExpenseSheet,
  openExpenseSheetAttachmentDownload,
  openExpenseSheetPdfDownload,
  saveExpenseSheetDraft,
  submitExpenseSheet,
  uploadExpenseSheetAttachment,
} from "@/api/workerExpenseSheetsApi";
import { ExpenseSheetAttachmentsEditor } from "@/components/admin/ExpenseSheetAttachmentsBlock";
import type {
  WorkerExpenseCategoryKey,
  WorkerExpenseLineAmounts,
  WorkerExpenseSheetRecord,
} from "@/types/workerExpenses";
import { WORKER_EXPENSE_CATEGORY_KEYS } from "@/types/workerExpenses";
import { cn } from "@/lib/utils";

function emptyAmounts(): WorkerExpenseLineAmounts {
  const a = {} as WorkerExpenseLineAmounts;
  for (const k of WORKER_EXPENSE_CATEGORY_KEYS) a[k] = 0;
  return a;
}

function parseCell(raw: string): number {
  const t = raw.replace(",", ".").trim();
  if (t === "") return 0;
  const n = parseFloat(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function formatCell(n: number): string {
  if (n === 0) return "";
  return String(n);
}

const CAT_KEYS: WorkerExpenseCategoryKey[] = [...WORKER_EXPENSE_CATEGORY_KEYS];

function catLabelKey(k: WorkerExpenseCategoryKey): string {
  const map: Record<WorkerExpenseCategoryKey, string> = {
    tickets: "admin.expenses.cat_tickets",
    taxisParking: "admin.expenses.cat_taxis_parking",
    kmsFuel: "admin.expenses.cat_kms_fuel",
    toll: "admin.expenses.cat_toll",
    perDiem: "admin.expenses.cat_per_diem",
    hotel: "admin.expenses.cat_hotel",
    supplies: "admin.expenses.cat_supplies",
    other: "admin.expenses.cat_other",
  };
  return map[k];
}

function statusBadgeVariant(
  status: WorkerExpenseSheetRecord["status"]
): "secondary" | "default" | "destructive" | "outline" {
  if (status === "APPROVED") return "default";
  if (status === "REJECTED") return "destructive";
  if (status === "SUBMITTED") return "secondary";
  return "outline";
}

function statusLabelKey(status: WorkerExpenseSheetRecord["status"]): string {
  const map: Record<WorkerExpenseSheetRecord["status"], string> = {
    DRAFT: "admin.expenses.status_draft",
    SUBMITTED: "admin.expenses.status_submitted",
    APPROVED: "admin.expenses.status_approved",
    REJECTED: "admin.expenses.status_rejected",
  };
  return map[status];
}

const WorkerExpenses = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAdminAuth();
  const companyWorkerId = user?.companyWorkerId ?? null;
  const hasModule = user?.enabledModules?.includes("GASTOS") === true;

  const now = new Date();
  const [periodMode, setPeriodMode] = useState<"MONTH" | "CUSTOM">("MONTH");
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [customFrom, setCustomFrom] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  );
  const [customTo, setCustomTo] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`
  );

  const [focusSheetId, setFocusSheetId] = useState<string | null>(null);
  const [pdfOpeningId, setPdfOpeningId] = useState<string | null>(null);
  const [draftObs, setDraftObs] = useState("");
  const [draftLines, setDraftLines] = useState<
    { expenseDate: string; amounts: WorkerExpenseLineAmounts }[]
  >([]);

  const { data: sheets = [], isLoading } = useWorkerExpenseSheets(companyWorkerId, hasModule);

  const sheet = useMemo(
    () => (focusSheetId ? sheets.find((s) => s.id === focusSheetId) ?? null : null),
    [sheets, focusSheetId]
  );

  useEffect(() => {
    if (!sheet) {
      setDraftObs("");
      setDraftLines([]);
      return;
    }
    setDraftObs(sheet.observations);
    setDraftLines(
      sheet.lines.map((l) => ({
        expenseDate: l.expenseDate,
        amounts: { ...l.amounts },
      }))
    );
  }, [sheet]);

  const localeTag = language === "en" ? "en-GB" : language === "ca" ? "ca-ES" : "es-ES";

  const editable = sheet && (sheet.status === "DRAFT" || sheet.status === "REJECTED");

  const setAmount = useCallback((expenseDate: string, key: WorkerExpenseCategoryKey, raw: string) => {
    const n = parseCell(raw);
    setDraftLines((prev) =>
      prev.map((row) =>
        row.expenseDate === expenseDate ? { ...row, amounts: { ...row.amounts, [key]: n } } : row
      )
    );
  }, []);

  const dailyTotal = useCallback((amounts: WorkerExpenseLineAmounts) => computeLineTotal(amounts), []);

  const columnTotals = useMemo(() => {
    const tot = emptyAmounts();
    for (const row of draftLines) {
      for (const k of CAT_KEYS) tot[k] += row.amounts[k] ?? 0;
    }
    for (const k of CAT_KEYS) tot[k] = Math.round(tot[k] * 100) / 100;
    return tot;
  }, [draftLines]);

  const grandTotal = useMemo(() => {
    let g = 0;
    for (const row of draftLines) g += dailyTotal(row.amounts);
    return Math.round(g * 100) / 100;
  }, [draftLines, dailyTotal]);

  const openPeriodMutation = useMutation({
    mutationFn: async () => {
      if (!companyWorkerId) throw new Error(t("admin.expenses.no_worker_profile"));
      if (periodMode === "MONTH") {
        return getOrCreateExpenseSheet(companyWorkerId, {
          periodKind: "MONTH",
          calendarYear: selYear,
          calendarMonth: selMonth,
        });
      }
      return getOrCreateExpenseSheet(companyWorkerId, {
        periodKind: "CUSTOM",
        periodStart: customFrom,
        periodEnd: customTo,
      });
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: queryKeys.workerExpenseSheets(companyWorkerId!) });
      setFocusSheetId(data.id);
      toast({ title: t("admin.expenses.toast_period_open") });
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!sheet) throw new Error("—");
      await saveExpenseSheetDraft(sheet.id, { observations: draftObs, lines: draftLines });
    },
    onSuccess: async () => {
      toast({ title: t("admin.expenses.toast_saved") });
      await qc.invalidateQueries({ queryKey: queryKeys.workerExpenseSheets(companyWorkerId!) });
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!sheet) throw new Error("—");
      await saveExpenseSheetDraft(sheet.id, { observations: draftObs, lines: draftLines });
      await submitExpenseSheet(sheet.id);
    },
    onSuccess: async () => {
      toast({ title: t("admin.expenses.toast_submitted") });
      await qc.invalidateQueries({ queryKey: queryKeys.workerExpenseSheets(companyWorkerId!) });
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

  if (!hasModule || !companyWorkerId) {
    return (
      <div className="space-y-2 py-8">
        <h1 className="text-2xl font-bold tracking-tight">{t("admin.expenses.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("admin.expenses.no_access")}</p>
      </div>
    );
  }

  const yearOptions = Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Euro className="h-7 w-7 text-primary" aria-hidden />
          {t("admin.expenses.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1 max-w-3xl">{t("admin.expenses.subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.expenses.open_period_title")}</CardTitle>
          <CardDescription>{t("admin.expenses.open_period_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={periodMode === "MONTH" ? "default" : "outline"}
              onClick={() => setPeriodMode("MONTH")}
            >
              {t("admin.expenses.mode_month")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={periodMode === "CUSTOM" ? "default" : "outline"}
              onClick={() => setPeriodMode("CUSTOM")}
            >
              {t("admin.expenses.mode_custom")}
            </Button>
          </div>

          {periodMode === "MONTH" ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label>{t("admin.expenses.year")}</Label>
                <Select value={String(selYear)} onValueChange={(v) => setSelYear(Number(v))}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.expenses.month")}</Label>
                <Select value={String(selMonth)} onValueChange={(v) => setSelMonth(Number(v))}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {new Date(2000, m - 1, 1).toLocaleString(localeTag, { month: "long" })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const d = new Date(selYear, selMonth - 2, 1);
                    setSelYear(d.getFullYear());
                    setSelMonth(d.getMonth() + 1);
                  }}
                >
                  {t("admin.expenses.prev_month_short")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const d = new Date();
                    setSelYear(d.getFullYear());
                    setSelMonth(d.getMonth() + 1);
                  }}
                >
                  {t("admin.expenses.this_month_short")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label>{t("admin.expenses.date_from")}</Label>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.expenses.date_to")}</Label>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-[160px]"
                />
              </div>
            </div>
          )}

          <div>
            <Button
              type="button"
              onClick={() => openPeriodMutation.mutate()}
              disabled={openPeriodMutation.isPending}
            >
              {openPeriodMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {t("admin.expenses.open_sheet")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {sheet ? (
        <Card>
          <CardHeader className="pb-2 flex flex-row flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">{t("admin.expenses.sheet_title")}</CardTitle>
              <CardDescription>
                {sheet.periodKind === "MONTH" && sheet.calendarYear && sheet.calendarMonth
                  ? `${sheet.calendarYear}-${String(sheet.calendarMonth).padStart(2, "0")}`
                  : `${sheet.periodStart} → ${sheet.periodEnd}`}
              </CardDescription>
            </div>
            <Badge variant={statusBadgeVariant(sheet.status)}>{t(statusLabelKey(sheet.status))}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {sheet.status === "REJECTED" && sheet.rejectionReason ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                <p className="font-medium text-destructive">{t("admin.expenses.rejection_label")}</p>
                <p className="text-muted-foreground mt-1">{sheet.rejectionReason}</p>
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 min-w-[100px] bg-card">{t("admin.expenses.col_day")}</TableHead>
                    {CAT_KEYS.map((k) => (
                      <TableHead key={k} className="text-right min-w-[88px] whitespace-normal text-xs font-medium">
                        {t(catLabelKey(k))}
                      </TableHead>
                    ))}
                    <TableHead className="text-right min-w-[90px]">{t("admin.expenses.col_day_total")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draftLines.map((row) => (
                    <TableRow key={row.expenseDate}>
                      <TableCell className="sticky left-0 z-10 bg-card text-sm whitespace-nowrap">
                        {new Date(`${row.expenseDate}T12:00:00`).toLocaleDateString(localeTag, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </TableCell>
                      {CAT_KEYS.map((k) => (
                        <TableCell key={k} className="p-1">
                          <Input
                            className="h-8 text-right tabular-nums text-xs px-1"
                            disabled={!editable}
                            value={formatCell(row.amounts[k])}
                            inputMode="decimal"
                            onChange={(e) => setAmount(row.expenseDate, k, e.target.value)}
                          />
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-medium tabular-nums text-sm">
                        {dailyTotal(row.amounts).toLocaleString(localeTag, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell className="sticky left-0 z-10 bg-muted/50">{t("admin.expenses.row_month_total")}</TableCell>
                    {CAT_KEYS.map((k) => (
                      <TableCell key={k} className="text-right tabular-nums text-sm">
                        {columnTotals[k].toLocaleString(localeTag, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                    ))}
                    <TableCell className="text-right tabular-nums">
                      {grandTotal.toLocaleString(localeTag, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <p className="text-xs text-muted-foreground">{t("admin.expenses.totals_hint")}</p>

            <ExpenseSheetAttachmentsEditor
              periodDates={draftLines.map((l) => l.expenseDate)}
              localeTag={localeTag}
              t={t}
              editable={!!editable}
              attachments={sheet.attachments ?? []}
              onUploadFiles={async (files, expenseDate) => {
                if (!sheet) return;
                try {
                  for (const file of files) {
                    await uploadExpenseSheetAttachment(sheet.id, file, expenseDate);
                  }
                  toast({ title: t("admin.expenses.attachments_toast_uploaded") });
                  await qc.invalidateQueries({ queryKey: queryKeys.workerExpenseSheets(companyWorkerId!) });
                } catch (e) {
                  toast({
                    title: t("admin.common.error"),
                    description: e instanceof Error ? e.message : "",
                    variant: "destructive",
                  });
                }
              }}
              onDelete={async (id) => {
                try {
                  await deleteExpenseSheetAttachment(id);
                  toast({ title: t("admin.expenses.attachments_toast_removed") });
                  await qc.invalidateQueries({ queryKey: queryKeys.workerExpenseSheets(companyWorkerId!) });
                } catch (e) {
                  toast({
                    title: t("admin.common.error"),
                    description: e instanceof Error ? e.message : "",
                    variant: "destructive",
                  });
                }
              }}
              onOpen={async (a) => openExpenseSheetAttachmentDownload(a)}
            />

            <div className="space-y-2">
              <Label htmlFor="exp-obs">{t("admin.expenses.observations")}</Label>
              <Textarea
                id="exp-obs"
                rows={3}
                disabled={!editable}
                value={draftObs}
                onChange={(e) => setDraftObs(e.target.value)}
                placeholder={t("admin.expenses.observations_placeholder")}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!editable || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {t("admin.expenses.save_draft")}
              </Button>
              <Button
                type="button"
                disabled={!editable || submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
              >
                {submitMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {t("admin.expenses.submit")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.expenses.history_title")}</CardTitle>
          <CardDescription>{t("admin.expenses.history_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-6">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("admin.common.loading")}
            </div>
          ) : sheets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t("admin.expenses.history_empty")}</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.expenses.col_period")}</TableHead>
                    <TableHead>{t("admin.expenses.col_status")}</TableHead>
                    <TableHead className="text-right">{t("admin.expenses.col_total")}</TableHead>
                    <TableHead className="text-right min-w-[200px]">{t("admin.common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sheets.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">
                        {s.periodKind === "MONTH" && s.calendarYear && s.calendarMonth
                          ? `${s.calendarYear}-${String(s.calendarMonth).padStart(2, "0")}`
                          : `${s.periodStart} → ${s.periodEnd}`}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(s.status)} className="font-normal">
                          {t(statusLabelKey(s.status))}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {computeSheetTotal(s).toLocaleString(localeTag, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        €
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn(focusSheetId === s.id && "bg-muted")}
                            onClick={() => setFocusSheetId(s.id)}
                          >
                            {t("admin.expenses.view")}
                          </Button>
                          {s.status === "APPROVED" && s.pdfStoragePath ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              disabled={pdfOpeningId === s.id}
                              onClick={() => {
                                void (async () => {
                                  try {
                                    setPdfOpeningId(s.id);
                                    await openExpenseSheetPdfDownload(s);
                                  } catch (e) {
                                    toast({
                                      title: t("admin.common.error"),
                                      description:
                                        e instanceof Error ? e.message : t("admin.expenses.pdf_open_error"),
                                      variant: "destructive",
                                    });
                                  } finally {
                                    setPdfOpeningId(null);
                                  }
                                })();
                              }}
                            >
                              {pdfOpeningId === s.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="h-3.5 w-3.5" />
                              )}
                              {t("admin.expenses.pdf_download_short")}
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkerExpenses;
