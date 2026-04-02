import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2, Send } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMyBackofficeMessages } from "@/hooks/useBackofficeMessages";
import {
  createBackofficeMessage,
  markBackofficeThreadAsRead,
} from "@/api/backofficeMessagesApi";
import { queryKeys } from "@/lib/queryKeys";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useBackofficeUsers } from "@/hooks/useBackofficeUsers";
import type { BackofficeMessageRecord } from "@/types/backofficeMessages";

const WorkerMessages = () => {
  const { t, language } = useLanguage();
  const { user } = useAdminAuth();
  const myUserId = user?.userId ?? "";
  const queryClient = useQueryClient();
  const { data: users = [] } = useBackofficeUsers();
  const { data: messages = [], isLoading, isError, error } = useMyBackofficeMessages();
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const localeTag = language === "en" ? "en-GB" : language === "ca" ? "ca-ES" : "es-ES";
  const formatDt = (iso: string) =>
    new Date(iso).toLocaleString(localeTag, { dateStyle: "short", timeStyle: "short" });

  const threads = useMemo(() => {
    const byId = new Map<string, BackofficeMessageRecord[]>();
    for (const m of messages) {
      const key = m.threadId || m.id;
      if (!byId.has(key)) byId.set(key, []);
      byId.get(key)!.push(m);
    }

    const userNameById = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()] as const));
    const out = [...byId.entries()].map(([threadId, rows]) => {
      const sorted = [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const last = sorted[sorted.length - 1]!;
      const unread = sorted.filter(
        (m) => m.recipientBackofficeUserId === myUserId && m.readAt === null
      ).length;
      const counterpartId =
        last.senderBackofficeUserId === myUserId
          ? last.recipientBackofficeUserId
          : last.senderBackofficeUserId;
      return {
        threadId,
        title: last.threadTitle ?? last.title,
        lastAt: last.createdAt,
        unreadCount: unread,
        counterpartId,
        counterpartName: counterpartId ? userNameById.get(counterpartId) ?? t("admin.messages.user_unknown") : t("admin.messages.system"),
        messages: sorted,
      };
    });
    return out.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }, [messages, myUserId, t, users]);

  useEffect(() => {
    if (threads.length === 0) {
      setActiveThreadId(null);
      return;
    }
    setActiveThreadId((prev) => (prev && threads.some((t) => t.threadId === prev) ? prev : threads[0]!.threadId));
  }, [threads]);

  const activeThread = threads.find((x) => x.threadId === activeThreadId) ?? null;

  const markReadMutation = useMutation({
    mutationFn: (threadId: string) => markBackofficeThreadAsRead(threadId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessages });
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessageUnreadCount });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      if (!activeThread || !activeThread.counterpartId) return;
      await createBackofficeMessage(activeThread.counterpartId, {
        category: "DIRECT_REPLY",
        title: activeThread.title,
        threadTitle: activeThread.title,
        threadId: activeThread.threadId,
        body: replyBody.trim(),
        payload: { kind: "thread_reply" },
      });
    },
    onSuccess: async () => {
      setReplyBody("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessages });
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessageUnreadCount });
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
        {error instanceof Error ? error.message : t("admin.messages.load_error")}
      </p>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bell className="h-6 w-6 text-primary" aria-hidden />
          {t("admin.messages.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t("admin.messages.subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.messages.inbox_title")}</CardTitle>
          <CardDescription>
            {t("admin.common.showing")} {threads.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {threads.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t("admin.messages.empty")}</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[280px,1fr]">
              <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                {threads.map((th) => (
                  <button
                    key={th.threadId}
                    type="button"
                    onClick={() => {
                      setActiveThreadId(th.threadId);
                      if (th.unreadCount > 0 && !markReadMutation.isPending) {
                        markReadMutation.mutate(th.threadId);
                      }
                    }}
                    className={`w-full text-left rounded-lg border px-3 py-2.5 space-y-1 ${
                      activeThreadId === th.threadId ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{th.title}</p>
                      {th.unreadCount > 0 ? <Badge>{th.unreadCount}</Badge> : null}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{th.counterpartName}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDt(th.lastAt)}</p>
                  </button>
                ))}
              </div>

              {activeThread ? (
                <div className="rounded-lg border p-3 md:p-4 space-y-3">
                  <div className="border-b pb-2">
                    <p className="font-medium">{activeThread.title}</p>
                    <p className="text-xs text-muted-foreground">{activeThread.counterpartName}</p>
                  </div>
                  <div className="space-y-2 max-h-[48vh] overflow-y-auto pr-1">
                    {activeThread.messages.map((m) => {
                      const mine = m.senderBackofficeUserId === myUserId;
                      return (
                        <div
                          key={m.id}
                          className={`rounded-lg px-3 py-2 text-sm border ${
                            mine ? "ml-8 bg-primary/10 border-primary/30" : "mr-8 bg-muted/30"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.body}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {formatDt(m.createdAt)}
                            {!mine && m.readAt ? ` · ${t("admin.messages.read_at")} ${formatDt(m.readAt)}` : ""}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t space-y-2">
                    {activeThread.counterpartId ? (
                      <>
                        <Textarea
                          rows={3}
                          value={replyBody}
                          onChange={(e) => setReplyBody(e.target.value)}
                          placeholder={t("admin.messages.reply_placeholder")}
                        />
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            className="gap-1.5"
                            disabled={!replyBody.trim() || replyMutation.isPending}
                            onClick={() => replyMutation.mutate()}
                          >
                            <Send className="h-4 w-4" />
                            {t("admin.messages.reply_send")}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">{t("admin.messages.system_thread_no_reply")}</p>
                    )}
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

export default WorkerMessages;
