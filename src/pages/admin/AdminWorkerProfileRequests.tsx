import { useState } from "react";
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
import { useCompanyWorkers } from "@/hooks/useCompanyWorkers";
import { useAllWorkerProfileChangeRequests } from "@/hooks/useWorkerProfileChangeRequests";
import {
  approveWorkerProfileChangeRequest,
  deleteWorkerProfileChangeRequest,
  rejectWorkerProfileChangeRequest,
} from "@/api/workerProfileChangeRequestsApi";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/hooks/use-toast";
import { companyWorkerDisplayName } from "@/types/companyWorkers";
import type { WorkerProfileChangeRequestRecord } from "@/types/workerProfileChangeRequests";

const AdminWorkerProfileRequests = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: workers = [] } = useCompanyWorkers();
  const { data: requests = [], isLoading, isError, error } = useAllWorkerProfileChangeRequests();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<WorkerProfileChangeRequestRecord | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const localeTag =
    language === "en" ? "en-GB" : language === "ca" ? "ca-ES" : "es-ES";
  const formatDt = (iso: string) =>
    new Date(iso).toLocaleString(localeTag, { dateStyle: "short", timeStyle: "short" });

  const approveMutation = useMutation({
    mutationFn: approveWorkerProfileChangeRequest,
    onSuccess: async () => {
      toast({ title: t("admin.workerProfileRequests.toast_approved") });
      await queryClient.invalidateQueries({ queryKey: queryKeys.workerProfileChangeRequests });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companyWorkers });
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeUsers });
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
      rejectWorkerProfileChangeRequest(id, reason),
    onSuccess: async () => {
      toast({ title: t("admin.workerProfileRequests.toast_rejected") });
      setRejectOpen(false);
      setRejectTarget(null);
      setRejectReason("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.workerProfileChangeRequests });
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
    mutationFn: deleteWorkerProfileChangeRequest,
    onSuccess: async () => {
      toast({ title: t("admin.workerProfileRequests.toast_deleted") });
      await queryClient.invalidateQueries({ queryKey: queryKeys.workerProfileChangeRequests });
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

  const workerName = (companyWorkerId: string) => {
    const w = workers.find((x) => x.id === companyWorkerId);
    return w ? companyWorkerDisplayName(w) : companyWorkerId;
  };

  const openReject = (req: WorkerProfileChangeRequestRecord) => {
    setRejectTarget(req);
    setRejectReason("");
    setRejectOpen(true);
  };

  const confirmReject = () => {
    if (!rejectTarget) return;
    rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason });
  };

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
        {error instanceof Error ? error.message : t("admin.workerProfileRequests.load_error")}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("admin.workerProfileRequests.title")}</h1>
        <p className="text-muted-foreground text-sm mt-1 max-w-3xl">
          {t("admin.workerProfileRequests.subtitle")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.workerProfileRequests.pending_title")}</CardTitle>
          <CardDescription>
            {t("admin.common.showing")} {requests.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {t("admin.workerProfileRequests.empty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.workerProfileRequests.col_worker")}</TableHead>
                  <TableHead>{t("admin.workerProfileRequests.col_date")}</TableHead>
                  <TableHead>{t("admin.common.status")}</TableHead>
                  <TableHead>{t("admin.workerProfileRequests.col_message")}</TableHead>
                  <TableHead>{t("admin.workerProfileRequests.col_changes")}</TableHead>
                  <TableHead className="text-right w-[160px]">{t("admin.common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {workerName(req.companyWorkerId)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {formatDt(req.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={req.status === "PENDING" ? "default" : "outline"}>{req.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px]">
                      {req.workerMessage || "—"}
                    </TableCell>
                    <TableCell className="text-xs max-w-md">
                      <DiffSummary
                        prev={req.previousSnapshot}
                        next={req.suggested}
                        t={t}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {req.status === "PENDING" ? (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              className="gap-1"
                              disabled={approveMutation.isPending}
                              onClick={() => approveMutation.mutate(req.id)}
                            >
                              <Check className="h-3.5 w-3.5" />
                              {t("admin.workerProfileRequests.approve")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-destructive"
                              disabled={rejectMutation.isPending}
                              onClick={() => openReject(req)}
                            >
                              <X className="h-3.5 w-3.5" />
                              {t("admin.workerProfileRequests.reject")}
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
            <DialogTitle>{t("admin.workerProfileRequests.reject_title")}</DialogTitle>
            <DialogDescription>{t("admin.workerProfileRequests.reject_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">{t("admin.workerProfileRequests.reject_reason_label")}</Label>
            <Textarea
              id="reject-reason"
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
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              onClick={confirmReject}
            >
              {t("admin.workerProfileRequests.reject_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function DiffSummary({
  prev,
  next,
  t,
}: {
  prev: WorkerProfileChangeRequestRecord["previousSnapshot"];
  next: WorkerProfileChangeRequestRecord["suggested"];
  t: (k: string) => string;
}) {
  if (!prev || !next) return <span className="text-muted-foreground">—</span>;
  const keys: (keyof WorkerProfileChangeRequestRecord["suggested"])[] = [
    "firstName",
    "lastName",
    "dni",
    "email",
    "mobile",
    "postalAddress",
    "city",
  ];
  const labels: Record<string, string> = {
    firstName: t("admin.workerProfile.field_first_name"),
    lastName: t("admin.workerProfile.field_last_name"),
    dni: t("admin.workerProfile.field_dni"),
    email: t("admin.workerProfile.field_email"),
    mobile: t("admin.workerProfile.field_mobile"),
    postalAddress: t("admin.workerProfile.field_address"),
    city: t("admin.workerProfile.field_city"),
  };
  const parts: string[] = [];
  for (const k of keys) {
    const a = String(prev[k] ?? "");
    const b = String(next[k] ?? "");
    if (a !== b) {
      parts.push(`${labels[k]}: ${a} → ${b}`);
    }
  }
  if (parts.length === 0) return <span>—</span>;
  return (
    <ul className="list-disc pl-4 space-y-0.5">
      {parts.map((p, i) => (
        <li key={i}>{p}</li>
      ))}
    </ul>
  );
}

export default AdminWorkerProfileRequests;
