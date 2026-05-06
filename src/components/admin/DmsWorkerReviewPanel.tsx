import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/queryKeys";
import {
  getDmsDocument,
  getDmsDocumentReviewByIdForAssignee,
  getDmsVersionSignedUrl,
  listDmsDocumentVersions,
  submitDmsDocumentReview,
  updateDmsReviewTaskPhases,
} from "@/api/dmsDocumentsApi";
import type { DmsDocumentReviewRecord } from "@/types/dmsDocuments";

type Props = {
  reviewId: string;
  /** Si el padre ya tiene la fila (p. ej. ficha admin), evita una petición extra. */
  initialReview?: DmsDocumentReviewRecord | null;
  onUpdated?: () => void;
};

export function DmsWorkerReviewPanel({ reviewId, initialReview, onUpdated }: Props) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAdminAuth();
  const actorId = user?.userId ?? "";

  const { data: fetchedReview, isLoading: loadingReview } = useQuery({
    queryKey: ["dmsWorkerReview", reviewId],
    queryFn: () => getDmsDocumentReviewByIdForAssignee(reviewId),
    enabled: !!reviewId && !!actorId && initialReview === undefined,
  });

  const review = initialReview !== undefined ? initialReview : fetchedReview ?? null;

  const documentId = review?.documentId ?? "";

  const { data: doc } = useQuery({
    queryKey: queryKeys.dmsDocument(documentId),
    queryFn: () => getDmsDocument(documentId),
    enabled: !!documentId,
  });

  const { data: versions = [] } = useQuery({
    queryKey: queryKeys.dmsDocumentVersions(documentId),
    queryFn: () => listDmsDocumentVersions(documentId),
    enabled: !!documentId,
  });

  const latestVersion = versions[0] ?? null;

  const [notOkComment, setNotOkComment] = useState("");
  const [notOkFile, setNotOkFile] = useState<File | null>(null);
  const [showNotOk, setShowNotOk] = useState(false);

  const canAct =
    !!review &&
    !!actorId &&
    review.assigneeBackofficeUserId === actorId &&
    (review.status === "ASSIGNED" || review.status === "CHANGES_REQUESTED");

  const phasesReady = !!(review?.taskReadAt && review?.taskReviewAt);

  const taskMut = useMutation({
    mutationFn: async (patch: { read?: boolean; review?: boolean }) => {
      if (!actorId) return;
      await updateDmsReviewTaskPhases({ reviewId, patch, actorBackofficeUserId: actorId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dmsWorkerReview", reviewId] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myDmsDocumentReviews });
      onUpdated?.();
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.dms.error_generic"),
        variant: "destructive",
      });
    },
  });

  const submitMut = useMutation({
    mutationFn: async (input: { outcome: "OK" | "NOT_OK"; file?: File | null; note?: string }) => {
      if (!actorId) return;
      await submitDmsDocumentReview({
        reviewId,
        outcome: input.outcome,
        workerNote: input.note ?? "",
        newVersionFile: input.file ?? null,
        actorBackofficeUserId: actorId,
      });
    },
    onSuccess: (_, vars) => {
      toast({
        title:
          vars.outcome === "OK"
            ? t("admin.dms.toast_review_submitted")
            : t("admin.dms.toast_review_submitted_revision"),
      });
      setShowNotOk(false);
      setNotOkComment("");
      setNotOkFile(null);
      void queryClient.invalidateQueries({ queryKey: ["dmsWorkerReview", reviewId] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myDmsDocumentReviews });
      if (documentId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.dmsDocumentReviews(documentId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.dmsDocumentVersions(documentId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.dmsDocument(documentId) });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessages });
      void queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessageUnreadCount });
      onUpdated?.();
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.dms.error_generic"),
        variant: "destructive",
      });
    },
  });

  const downloadLatest = async () => {
    if (!actorId || !latestVersion || !documentId) return;
    try {
      const url = await getDmsVersionSignedUrl(latestVersion.id, {
        logDownload: true,
        actorBackofficeUserId: actorId,
        documentId,
      });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.dms.error_generic"),
        variant: "destructive",
      });
    }
  };

  const versionLabel = useMemo(() => {
    if (!latestVersion) return "—";
    return `v${latestVersion.versionNumber} · ${latestVersion.originalFilename}`;
  }, [latestVersion]);

  if (initialReview === undefined && loadingReview) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("admin.common.loading")}
      </div>
    );
  }

  if (!review) {
    return (
      <p className="text-sm text-muted-foreground py-2">{t("admin.dms.worker_review_not_found")}</p>
    );
  }

  if (!canAct) {
    return (
      <div className="rounded-md border bg-muted/20 p-3 text-sm space-y-1">
        <p className="font-medium">{t("admin.dms.worker_review_closed")}</p>
        {review.workerOutcome ? (
          <p className="text-xs text-muted-foreground">
            {review.workerOutcome === "OK"
              ? t("admin.dms.worker_outcome_ok")
              : t("admin.dms.worker_outcome_not_ok")}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3 text-sm">
      <div>
        <p className="font-medium">{doc?.name ?? "—"}</p>
        <p className="text-xs text-muted-foreground">{versionLabel}</p>
      </div>
      {review.requestNote ? (
        <p className="text-xs text-muted-foreground whitespace-pre-wrap border-l-2 pl-2">{review.requestNote}</p>
      ) : null}

      {latestVersion ? (
        <Button type="button" size="sm" variant="outline" className="gap-2" onClick={() => void downloadLatest()}>
          <Download className="h-4 w-4" />
          {t("admin.dms.worker_download_current")}
        </Button>
      ) : null}

      <div className="space-y-2 rounded-md border p-2 bg-muted/20">
        <p className="text-xs font-medium">{t("admin.dms.review_task_phases")}</p>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!review.taskReadAt}
            disabled={taskMut.isPending}
            onChange={(e) => taskMut.mutate({ read: e.target.checked })}
          />
          <span>{t("admin.dms.task_read")}</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!review.taskReviewAt}
            disabled={taskMut.isPending}
            onChange={(e) => taskMut.mutate({ review: e.target.checked })}
          />
          <span>{t("admin.dms.task_review")}</span>
        </label>
      </div>

      {!phasesReady ? (
        <p className="text-xs text-muted-foreground">{t("admin.dms.review_phases_two_required")}</p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-medium">{t("admin.dms.worker_decision_title")}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={submitMut.isPending}
              onClick={() => submitMut.mutate({ outcome: "OK", note: notOkComment || undefined })}
            >
              {t("admin.dms.worker_ok")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={submitMut.isPending}
              onClick={() => setShowNotOk((v) => !v)}
            >
              {t("admin.dms.worker_not_ok")}
            </Button>
          </div>

          {showNotOk ? (
            <div className="space-y-2 rounded-md border p-2 bg-destructive/5">
              <Label className="text-xs">{t("admin.dms.worker_not_ok_comment")}</Label>
              <Textarea rows={3} value={notOkComment} onChange={(e) => setNotOkComment(e.target.value)} />
              <Label className="text-xs">{t("admin.dms.worker_not_ok_file")}</Label>
              <InputFile onChange={setNotOkFile} />
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={submitMut.isPending || !notOkComment.trim() || !notOkFile}
                onClick={() => submitMut.mutate({ outcome: "NOT_OK", note: notOkComment, file: notOkFile })}
              >
                {t("admin.dms.worker_not_ok_submit")}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function InputFile({ onChange }: { onChange: (f: File | null) => void }) {
  return (
    <input
      type="file"
      className="text-xs w-full"
      onChange={(e) => onChange(e.target.files?.[0] ?? null)}
    />
  );
}
