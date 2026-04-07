import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Trash2, X } from "lucide-react";
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
import { queryKeys } from "@/lib/queryKeys";
import { useCompanyWorkers } from "@/hooks/useCompanyWorkers";
import { useWorkCalendarSites } from "@/hooks/useWorkCalendarSites";
import { useAllWorkerVacationChangeRequests } from "@/hooks/useWorkerVacationChangeRequests";
import {
  approveWorkerVacationChangeRequest,
  deleteWorkerVacationChangeRequest,
  rejectWorkerVacationChangeRequest,
} from "@/api/workerVacationChangeRequestsApi";
import { companyWorkerDisplayName } from "@/types/companyWorkers";
import type { WorkerVacationChangeRequestRecord } from "@/types/workerVacationChangeRequests";

function DiffSummary({ req }: { req: WorkerVacationChangeRequestRecord }) {
  const prev = new Set(req.previousApprovedDates);
  const next = new Set(req.proposedDates);
  const added = [...next].filter((d) => !prev.has(d)).sort();
  const removed = [...prev].filter((d) => !next.has(d)).sort();
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">
        +{added.length} / -{removed.length}
      </p>
      {added.length > 0 ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">+ {added.slice(0, 4).join(", ")}{added.length > 4 ? "..." : ""}</p>
      ) : null}
      {removed.length > 0 ? (
        <p className="text-xs text-rose-700 dark:text-rose-400">- {removed.slice(0, 4).join(", ")}{removed.length > 4 ? "..." : ""}</p>
      ) : null}
    </div>
  );
}

const AdminVacationRequests = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: workers = [] } = useCompanyWorkers();
  const { data: sites = [] } = useWorkCalendarSites();
  const { data: requests = [], isLoading, isError, error } = useAllWorkerVacationChangeRequests();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<WorkerVacationChangeRequestRecord | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const localeTag = language === "en" ? "en-GB" : language === "ca" ? "ca-ES" : "es-ES";
  const formatDt = (iso: string) =>
    new Date(iso).toLocaleString(localeTag, { dateStyle: "short", timeStyle: "short" });

  const workerNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of workers) m.set(w.id, companyWorkerDisplayName(w));
    return m;
  }, [workers]);
  const siteNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sites) m.set(s.id, s.name);
    return m;
  }, [sites]);
  const workerSiteName = (workerId: string) => {
    const w = workers.find((x) => x.id === workerId);
    if (!w) return "—";
    return siteNameById.get(w.workCalendarSiteId) ?? "—";
  };

  const approveMutation = useMutation({
    mutationFn: approveWorkerVacationChangeRequest,
    onSuccess: async () => {
      toast({ title: t("admin.vacationRequests.toast_approved") });
      await queryClient.invalidateQueries({ queryKey: queryKeys.workerVacationChangeRequests });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companyWorkers });
      await queryClient.invalidateQueries({ queryKey: ["workerVacationDays"] });
      await queryClient.invalidateQueries({ queryKey: ["adminVacationSummaries"] });
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
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectWorkerVacationChangeRequest(id, reason),
    onSuccess: async () => {
      toast({ title: t("admin.vacationRequests.toast_rejected") });
      setRejectOpen(false);
      setRejectTarget(null);
      setRejectReason("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.workerVacationChangeRequests });
      await queryClient.invalidateQueries({ queryKey: ["workerVacationChangeRequests"] });
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWorkerVacationChangeRequest,
    onSuccess: async () => {
      toast({ title: t("admin.vacationRequests.toast_deleted") });
      await queryClient.invalidateQueries({ queryKey: queryKeys.workerVacationChangeRequests });
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
        {error instanceof Error ? error.message : t("admin.vacationRequests.load_error")}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("admin.vacationRequests.title")}</h1>
        <p className="text-muted-foreground text-sm mt-1 max-w-3xl">
          {t("admin.vacationRequests.subtitle")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.vacationRequests.pending_title")}</CardTitle>
          <CardDescription>
            {t("admin.common.showing")} {requests.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t("admin.vacationRequests.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.vacationRequests.col_worker")}</TableHead>
                  <TableHead>{t("admin.vacationRequests.col_site")}</TableHead>
                  <TableHead>{t("admin.vacationRequests.col_year")}</TableHead>
                  <TableHead>{t("admin.vacationRequests.col_date")}</TableHead>
                  <TableHead>{t("admin.common.status")}</TableHead>
                  <TableHead>{t("admin.vacationRequests.col_message")}</TableHead>
                  <TableHead>{t("admin.vacationRequests.col_changes")}</TableHead>
                  <TableHead className="text-right w-[160px]">{t("admin.common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {workerNameById.get(req.companyWorkerId) ?? req.companyWorkerId}
                    </TableCell>
                    <TableCell>{workerSiteName(req.companyWorkerId)}</TableCell>
                    <TableCell className="tabular-nums">{req.calendarYear}</TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {formatDt(req.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={req.status === "PENDING" ? "default" : "outline"}>{req.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-[220px]">{req.workerMessage || "—"}</TableCell>
                    <TableCell className="text-xs max-w-md">
                      <DiffSummary req={req} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {req.status === "PENDING" ? (
                          <>
                            <Button
                              size="sm"
                              className="gap-1"
                              disabled={approveMutation.isPending}
                              onClick={() => approveMutation.mutate(req.id)}
                            >
                              <Check className="h-3.5 w-3.5" />
                              {t("admin.vacationRequests.approve")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-destructive"
                              disabled={rejectMutation.isPending}
                              onClick={() => {
                                setRejectTarget(req);
                                setRejectReason("");
                                setRejectOpen(true);
                              }}
                            >
                              <X className="h-3.5 w-3.5" />
                              {t("admin.vacationRequests.reject")}
                            </Button>
                          </>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(req.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t("admin.common.delete")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.vacationRequests.reject_title")}</DialogTitle>
            <DialogDescription>{t("admin.vacationRequests.reject_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="vac-reject-reason">{t("admin.vacationRequests.reject_reason_label")}</Label>
            <Textarea
              id="vac-reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              {t("admin.common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || rejectMutation.isPending || !rejectTarget}
              onClick={() => {
                if (!rejectTarget) return;
                rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason });
              }}
            >
              {t("admin.vacationRequests.reject_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminVacationRequests;
