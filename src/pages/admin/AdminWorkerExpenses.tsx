import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Download, Euro, Eye, Loader2, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useCompanyWorkers } from "@/hooks/useCompanyWorkers";
import { useAllWorkerExpenseSheets } from "@/hooks/useWorkerExpenseSheets";
import { queryKeys } from "@/lib/queryKeys";
import {
  approveExpenseSheet,
  computeSheetTotal,
  fetchWorkerExpenseSheetById,
  openExpenseSheetAttachmentDownload,
  openExpenseSheetPdfDownload,
  rejectExpenseSheet,
} from "@/api/workerExpenseSheetsApi";
import { ExpenseSheetAttachmentsList } from "@/components/admin/ExpenseSheetAttachmentsBlock";
import { companyWorkerDisplayName } from "@/types/companyWorkers";
import type { WorkerExpenseSheetRecord } from "@/types/workerExpenses";
import { WorkerExpenseSheetReadonlyGrid } from "@/components/admin/WorkerExpenseSheetReadonlyGrid";

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

const AdminWorkerExpenses = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: workers = [] } = useCompanyWorkers();
  const { data: sheets = [], isLoading, isError, error } = useAllWorkerExpenseSheets(true);

  const [detailSheetId, setDetailSheetId] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<WorkerExpenseSheetRecord | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [pdfOpening, setPdfOpening] = useState(false);
  const [attachmentOpenId, setAttachmentOpenId] = useState<string | null>(null);

  const localeTag = language === "en" ? "en-GB" : language === "ca" ? "ca-ES" : "es-ES";

  const workerNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of workers) m.set(w.id, companyWorkerDisplayName(w));
    return m;
  }, [workers]);

  const filtered = useMemo(() => {
    if (filter === "pending") return sheets.filter((s) => s.status === "SUBMITTED");
    return sheets;
  }, [sheets, filter]);

  const {
    data: detailSheet,
    isLoading: detailLoading,
    isError: detailError,
    error: detailErr,
  } = useQuery({
    queryKey: ["workerExpenseSheetDetail", detailSheetId] as const,
    queryFn: () => fetchWorkerExpenseSheetById(detailSheetId!),
    enabled: Boolean(detailSheetId),
  });

  const closeDetail = () => {
    setDetailSheetId(null);
  };

  const invalidateAll = async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.workerExpenseSheetsAdmin });
    await qc.invalidateQueries({ queryKey: ["workerExpenseSheetDetail"] });
  };

  const approveMutation = useMutation({
    mutationFn: approveExpenseSheet,
    onSuccess: async () => {
      toast({ title: t("admin.expenses.admin_toast_approved") });
      closeDetail();
      await invalidateAll();
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectExpenseSheet(id, reason),
    onSuccess: async () => {
      toast({ title: t("admin.expenses.admin_toast_rejected") });
      setRejectOpen(false);
      setRejectTarget(null);
      setRejectReason("");
      closeDetail();
      await invalidateAll();
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
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
        {error instanceof Error ? error.message : t("admin.expenses.admin_load_error")}
      </p>
    );
  }

  const detailWorkerName = detailSheet
    ? workerNameById.get(detailSheet.companyWorkerId) ?? detailSheet.companyWorkerId
    : "";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Euro className="h-7 w-7 text-primary" aria-hidden />
          {t("admin.expenses.admin_title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1 max-w-3xl">{t("admin.expenses.admin_subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={filter === "pending" ? "default" : "outline"}
          onClick={() => setFilter("pending")}
        >
          {t("admin.expenses.admin_filter_pending")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
        >
          {t("admin.expenses.admin_filter_all")}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.expenses.admin_list_title")}</CardTitle>
          <CardDescription>{t("admin.expenses.admin_list_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">{t("admin.expenses.admin_empty")}</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.expenses.col_worker")}</TableHead>
                    <TableHead>{t("admin.expenses.col_period")}</TableHead>
                    <TableHead>{t("admin.expenses.col_status")}</TableHead>
                    <TableHead className="text-right">{t("admin.expenses.col_total")}</TableHead>
                    <TableHead className="text-right">{t("admin.expenses.col_submitted")}</TableHead>
                    <TableHead className="text-right w-[140px]">{t("admin.common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        {workerNameById.get(s.companyWorkerId) ?? s.companyWorkerId}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
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
                      <TableCell className="text-right text-sm text-muted-foreground whitespace-nowrap">
                        {s.submittedAt
                          ? new Date(s.submittedAt).toLocaleString(localeTag, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => setDetailSheetId(s.id)}
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden />
                          {t("admin.expenses.open_detail")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={detailSheetId !== null}
        onOpenChange={(open) => {
          if (!open) closeDetail();
        }}
      >
        <DialogContent className="max-h-[90vh] flex flex-col gap-0 overflow-hidden sm:max-w-4xl p-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0 space-y-1">
            <DialogTitle>{t("admin.expenses.detail_title")}</DialogTitle>
            <DialogDescription>{t("admin.expenses.detail_desc")}</DialogDescription>
          </DialogHeader>

          <div className="px-6 flex-1 min-h-0 overflow-y-auto space-y-4 pb-4">
            {detailLoading ? (
              <div className="flex items-center gap-2 py-12 text-muted-foreground justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
                {t("admin.common.loading")}
              </div>
            ) : detailError || !detailSheet ? (
              <p className="text-destructive text-sm py-4">
                {detailErr instanceof Error ? detailErr.message : t("admin.expenses.detail_load_error")}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{detailWorkerName}</p>
                    <p className="text-sm text-muted-foreground">
                      {detailSheet.periodKind === "MONTH" &&
                      detailSheet.calendarYear &&
                      detailSheet.calendarMonth
                        ? `${detailSheet.calendarYear}-${String(detailSheet.calendarMonth).padStart(2, "0")}`
                        : `${detailSheet.periodStart} → ${detailSheet.periodEnd}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={statusBadgeVariant(detailSheet.status)}>{t(statusLabelKey(detailSheet.status))}</Badge>
                    <span className="text-sm tabular-nums font-semibold">
                      {t("admin.expenses.col_total")}:{" "}
                      {computeSheetTotal(detailSheet).toLocaleString(localeTag, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      €
                    </span>
                  </div>
                </div>

                <WorkerExpenseSheetReadonlyGrid sheet={detailSheet} localeTag={localeTag} t={t} />

                <div className="space-y-2">
                  <p className="text-sm font-medium">{t("admin.expenses.attachments_title")}</p>
                  <p className="text-xs text-muted-foreground">{t("admin.expenses.attachments_admin_hint")}</p>
                  <ExpenseSheetAttachmentsList
                    attachments={detailSheet.attachments ?? []}
                    localeTag={localeTag}
                    t={t}
                    onOpen={async (a) => {
                      setAttachmentOpenId(a.id);
                      try {
                        await openExpenseSheetAttachmentDownload(a);
                      } catch (e) {
                        toast({
                          title: t("admin.common.error"),
                          description: e instanceof Error ? e.message : t("admin.expenses.pdf_open_error"),
                          variant: "destructive",
                        });
                      } finally {
                        setAttachmentOpenId(null);
                      }
                    }}
                    openPendingId={attachmentOpenId}
                  />
                </div>

                <div className="space-y-1.5">
                  <p className="text-sm font-medium">{t("admin.expenses.observations")}</p>
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm whitespace-pre-wrap min-h-[3rem]">
                    {detailSheet.observations?.trim() ? detailSheet.observations : "—"}
                  </div>
                </div>

                {detailSheet.status === "REJECTED" && detailSheet.rejectionReason ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                    <p className="font-medium text-destructive">{t("admin.expenses.rejection_label")}</p>
                    <p className="text-muted-foreground mt-1">{detailSheet.rejectionReason}</p>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-muted/20 shrink-0 flex-row flex-wrap gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={closeDetail}>
              {t("admin.expenses.detail_close")}
            </Button>
            <div className="flex flex-wrap items-center gap-2 justify-end sm:ml-auto">
              {detailSheet && detailSheet.status === "SUBMITTED" ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-1"
                    disabled={rejectMutation.isPending}
                    onClick={() => {
                      setRejectTarget(detailSheet);
                      setRejectReason("");
                      setRejectOpen(true);
                    }}
                  >
                    <X className="h-4 w-4" />
                    {t("admin.expenses.reject")}
                  </Button>
                  <Button
                    type="button"
                    className="gap-1"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate(detailSheet.id)}
                  >
                    {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {t("admin.expenses.approve")}
                  </Button>
                </>
              ) : null}
              {detailSheet && detailSheet.status === "APPROVED" && detailSheet.pdfStoragePath ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-1"
                  disabled={pdfOpening}
                  onClick={() => {
                    void (async () => {
                      try {
                        setPdfOpening(true);
                        await openExpenseSheetPdfDownload(detailSheet);
                      } catch (e) {
                        toast({
                          title: t("admin.common.error"),
                          description: e instanceof Error ? e.message : t("admin.expenses.pdf_open_error"),
                          variant: "destructive",
                        });
                      } finally {
                        setPdfOpening(false);
                      }
                    })();
                  }}
                >
                  {pdfOpening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {t("admin.expenses.pdf_download")}
                </Button>
              ) : null}
              {detailSheet && detailSheet.status !== "SUBMITTED" && detailSheet.status === "APPROVED" && !detailSheet.pdfStoragePath ? (
                <span className="text-xs text-muted-foreground max-w-[220px] text-right">
                  {t("admin.expenses.pdf_missing_hint")}
                </span>
              ) : null}
              {detailSheet && detailSheet.status !== "SUBMITTED" && detailSheet.status !== "APPROVED" ? (
                <span className="text-xs text-muted-foreground">{t("admin.expenses.detail_readonly_hint")}</span>
              ) : null}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("admin.expenses.reject_title")}</DialogTitle>
            <DialogDescription>{t("admin.expenses.reject_dialog_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="rej-reason">{t("admin.expenses.reject_reason_label")}</Label>
            <Textarea
              id="rej-reason"
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t("admin.expenses.reject_reason_placeholder")}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
              {t("admin.common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={rejectMutation.isPending || !rejectTarget}
              onClick={() => {
                if (!rejectTarget) return;
                rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason });
              }}
            >
              {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("admin.expenses.reject_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminWorkerExpenses;
