import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Inbox, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useMyBackofficeMessages } from "@/hooks/useBackofficeMessages";
import { useCompanyWorkers } from "@/hooks/useCompanyWorkers";
import {
  deleteBackofficeMessageForMe,
  markBackofficeMessageAsRead,
  updateBackofficeMessageRequestStatus,
} from "@/api/backofficeMessagesApi";
import { queryKeys } from "@/lib/queryKeys";

const AdminTimeClockRequests = () => {
  const { t, language } = useLanguage();
  const { user } = useAdminAuth();
  const queryClient = useQueryClient();
  const myUserId = user?.userId ?? "";
  const { data: messages = [], isLoading, isError, error } = useMyBackofficeMessages(true);
  const { data: workers = [] } = useCompanyWorkers();
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const workerNameById = useMemo(
    () => new Map(workers.map((w) => [w.id, `${w.firstName} ${w.lastName}`.trim()] as const)),
    [workers]
  );

  const requests = useMemo(
    () =>
      messages
        .filter((m) => m.category === "TIME_CLOCK_CORRECTION" && m.recipientBackofficeUserId === myUserId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [messages, myUserId]
  );
  const activeRequest = requests.find((r) => r.id === activeRequestId) ?? requests[0] ?? null;
  const activePayload = (activeRequest?.payload ?? {}) as {
    workerId?: string;
    relatedDate?: string;
    requestStatus?: "PENDING" | "APPROVED" | "REJECTED";
    reviewNote?: string | null;
  };
  const activeStatus = activePayload.requestStatus ?? "PENDING";

  const localeTag = language === "en" ? "en-GB" : language === "ca" ? "ca-ES" : "es-ES";
  const formatDt = (iso: string) =>
    new Date(iso).toLocaleString(localeTag, { dateStyle: "short", timeStyle: "short" });

  const markReadMutation = useMutation({
    mutationFn: (messageId: string) => markBackofficeMessageAsRead(messageId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessages });
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessageUnreadCount });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      status,
      note,
    }: {
      id: string;
      status: "APPROVED" | "REJECTED";
      note?: string;
    }) => updateBackofficeMessageRequestStatus(id, status, note),
    onSuccess: async () => {
      setReviewNote("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessages });
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessageUnreadCount });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBackofficeMessageForMe,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessages });
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessageUnreadCount });
      setActiveRequestId(null);
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
        {error instanceof Error ? error.message : t("admin.timeClock.requests_load_error")}
      </p>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Inbox className="h-6 w-6 text-primary" />
          {t("admin.timeClock.requests_title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t("admin.timeClock.requests_subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.timeClock.requests_inbox_title")}</CardTitle>
          <CardDescription>
            {t("admin.common.showing")} {requests.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t("admin.timeClock.requests_empty")}</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
              <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                {requests.map((m) => {
                  const payload = m.payload as {
                    workerId?: string;
                    relatedDate?: string;
                    requestStatus?: "PENDING" | "APPROVED" | "REJECTED";
                  };
                  const workerId = payload.workerId ?? "";
                  const workerName = workerNameById.get(workerId) ?? t("admin.messages.user_unknown");
                  const status = payload.requestStatus ?? "PENDING";
                  const active = activeRequest?.id === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setActiveRequestId(m.id);
                        if (!m.readAt && !markReadMutation.isPending) markReadMutation.mutate(m.id);
                      }}
                      className={`w-full text-left rounded-lg border px-3 py-2.5 space-y-1 ${
                        active ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{workerName}</p>
                        <Badge variant={status === "PENDING" ? "default" : "outline"}>{status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("admin.timeClock.request_date_label")} {payload.relatedDate ?? "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{formatDt(m.createdAt)}</p>
                    </button>
                  );
                })}
              </div>

              {activeRequest ? (
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">
                      {workerNameById.get(activePayload.workerId ?? "") ?? t("admin.messages.user_unknown")}
                    </p>
                    <Badge variant={activeStatus === "PENDING" ? "default" : "outline"}>{activeStatus}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("admin.timeClock.request_date_label")} {activePayload.relatedDate ?? "—"}
                  </p>
                  <p className="text-sm whitespace-pre-wrap rounded-md border bg-muted/20 p-3">
                    {activeRequest.body}
                  </p>
                  {activePayload.reviewNote ? (
                    <p className="text-xs text-muted-foreground">
                      {t("admin.timeClock.request_review_note_label")} {activePayload.reviewNote}
                    </p>
                  ) : null}
                  {activeStatus === "PENDING" ? (
                    <div className="space-y-2">
                      <Textarea
                        rows={2}
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        placeholder={t("admin.timeClock.request_review_note_placeholder")}
                      />
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="text-destructive"
                          disabled={reviewMutation.isPending}
                          onClick={() =>
                            reviewMutation.mutate({
                              id: activeRequest.id,
                              status: "REJECTED",
                              note: reviewNote,
                            })
                          }
                        >
                          {t("admin.timeClock.request_reject")}
                        </Button>
                        <Button
                          type="button"
                          disabled={reviewMutation.isPending}
                          onClick={() =>
                            reviewMutation.mutate({
                              id: activeRequest.id,
                              status: "APPROVED",
                              note: reviewNote,
                            })
                          }
                        >
                          {t("admin.timeClock.request_approve")}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap justify-between gap-2 pt-2 border-t">
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(activeRequest.id)}
                    >
                      {t("admin.timeClock.request_delete")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      asChild
                    >
                      <Link to="/admin/control-fichajes">{t("admin.timeClock.request_open_timeclock")}</Link>
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminTimeClockRequests;
