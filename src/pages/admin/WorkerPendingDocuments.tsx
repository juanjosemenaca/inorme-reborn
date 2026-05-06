import { Link } from "react-router-dom";
import { ClipboardList, Loader2, MessageSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMyDmsDocumentReviewsAsAssignee } from "@/hooks/useMyDmsDocumentReviews";
import { DmsWorkerReviewPanel } from "@/components/admin/DmsWorkerReviewPanel";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getDmsDocument } from "@/api/dmsDocumentsApi";
import { queryKeys } from "@/lib/queryKeys";
import type { DmsDocumentReviewRecord } from "@/types/dmsDocuments";

function ReviewDocTitle({ documentId }: { documentId: string }) {
  const { t } = useLanguage();
  const { data: doc, isLoading } = useQuery({
    queryKey: queryKeys.dmsDocument(documentId),
    queryFn: () => getDmsDocument(documentId),
    enabled: !!documentId,
  });
  if (isLoading) return <span className="text-muted-foreground text-sm">{t("admin.common.loading")}</span>;
  return <span className="font-medium text-sm">{doc?.name ?? documentId}</span>;
}

function PendingReviewCard({ review }: { review: DmsDocumentReviewRecord }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const statusLabel =
    review.status === "CHANGES_REQUESTED"
      ? t("admin.dms.review_status_CHANGES_REQUESTED")
      : t("admin.dms.review_status_ASSIGNED");

  return (
    <Card className="border-2 shadow-sm">
      <CardHeader className="pb-2 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardList className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <ReviewDocTitle documentId={review.documentId} />
          </div>
          <Badge variant="outline" className="shrink-0">
            {statusLabel}
          </Badge>
        </div>
        {review.requestNote ? (
          <CardDescription className="text-xs">{review.requestNote}</CardDescription>
        ) : null}
        <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
          <Link to="/admin/mensajes" className="inline-flex items-center gap-2">
            <MessageSquare className="h-4 w-4" aria-hidden />
            {t("admin.dms.worker_open_in_messages")}
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <DmsWorkerReviewPanel
            reviewId={review.id}
            initialReview={review}
            onUpdated={async () => {
              await queryClient.invalidateQueries({ queryKey: queryKeys.myDmsDocumentReviews });
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

const WorkerPendingDocuments = () => {
  const { t } = useLanguage();
  const { data: reviews = [], isLoading, isError, error } = useMyDmsDocumentReviewsAsAssignee();

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
        {error instanceof Error ? error.message : t("admin.dms.error_generic")}
      </p>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" aria-hidden />
          {t("admin.dms.worker_pending_page_title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t("admin.dms.worker_pending_page_subtitle")}</p>
      </div>

      {reviews.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("admin.dms.worker_pending_empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {reviews.map((r) => (
            <PendingReviewCard key={r.id} review={r} />
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkerPendingDocuments;
