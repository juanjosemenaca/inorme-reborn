import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Check, ChevronsUpDown, Loader2, MailPlus, Search, Send, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useBackofficeUsers } from "@/hooks/useBackofficeUsers";
import { useMyBackofficeMessages } from "@/hooks/useBackofficeMessages";
import {
  archiveBackofficeThreadForMe,
  createBackofficeMessage,
  deleteBackofficeThreadForMe,
  markBackofficeThreadAsRead,
  unarchiveBackofficeThreadForMe,
} from "@/api/backofficeMessagesApi";
import { queryKeys } from "@/lib/queryKeys";
import type { BackofficeMessageRecord } from "@/types/backofficeMessages";
import { cn } from "@/lib/utils";

const AdminWorkerMessages = () => {
  const { t, language } = useLanguage();
  const { user } = useAdminAuth();
  const myUserId = user?.userId ?? "";
  const queryClient = useQueryClient();
  const { data: users = [] } = useBackofficeUsers();
  const [showArchived, setShowArchived] = useState(false);
  const { data: messages = [], isLoading, isError, error } = useMyBackofficeMessages(true, showArchived);

  const [targetWorkerUserId, setTargetWorkerUserId] = useState<string>("");
  const [workerComboOpen, setWorkerComboOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [threadQuery, setThreadQuery] = useState("");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const localeTag = language === "en" ? "en-GB" : language === "ca" ? "ca-ES" : "es-ES";
  const formatDt = (iso: string) =>
    new Date(iso).toLocaleString(localeTag, { dateStyle: "short", timeStyle: "short" });

  const workerUsers = useMemo(
    () => users.filter((u) => u.role === "WORKER" && u.active),
    [users]
  );
  const selectedWorker = useMemo(
    () => workerUsers.find((u) => u.id === targetWorkerUserId),
    [targetWorkerUserId, workerUsers]
  );

  const workerSearchValue = (u: (typeof workerUsers)[number]) =>
    `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase();

  const payloadHasMe = (payload: Record<string, unknown>, key: string): boolean => {
    const raw = payload[key];
    return Array.isArray(raw) && raw.some((v) => v === myUserId);
  };

  const threads = useMemo(() => {
    const byId = new Map<string, BackofficeMessageRecord[]>();
    for (const m of messages) {
      const key = m.threadId || m.id;
      if (!byId.has(key)) byId.set(key, []);
      byId.get(key)!.push(m);
    }
    const userById = new Map(users.map((u) => [u.id, u] as const));
    const out = [...byId.entries()]
      .map(([threadId, rows]) => {
        const sorted = [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const last = sorted[sorted.length - 1]!;
        const counterpartId =
          last.senderBackofficeUserId === myUserId
            ? last.recipientBackofficeUserId
            : last.senderBackofficeUserId;
        const unread = sorted.filter(
          (m) => m.recipientBackofficeUserId === myUserId && m.readAt === null
        ).length;
        const archived = sorted.some((m) => payloadHasMe(m.payload, "archivedByProfileIds"));
        return {
          threadId,
          title: last.threadTitle ?? last.title,
          lastAt: last.createdAt,
          messages: sorted,
          counterpartId,
          counterpartName: counterpartId
            ? `${userById.get(counterpartId)?.firstName ?? ""} ${userById.get(counterpartId)?.lastName ?? ""}`.trim() ||
              t("admin.messages.user_unknown")
            : t("admin.messages.system"),
          counterpartEmail: counterpartId ? userById.get(counterpartId)?.email ?? "" : "",
          unreadCount: unread,
          archived,
        };
      })
      .filter((th) => {
        if (!th.counterpartId) return false;
        const counterpart = users.find((u) => u.id === th.counterpartId);
        return counterpart?.role === "WORKER";
      })
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    return out;
  }, [messages, myUserId, t, users]);

  const filteredThreads = useMemo(() => {
    const q = threadQuery.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((th) => {
      const searchable = [
        th.title,
        th.counterpartName,
        th.counterpartEmail,
        ...th.messages.map((m) => m.body),
      ]
        .join(" ")
        .toLowerCase();
      return searchable.includes(q);
    });
  }, [threadQuery, threads]);

  useEffect(() => {
    if (filteredThreads.length === 0) {
      setActiveThreadId(null);
      return;
    }
    setActiveThreadId((prev) =>
      prev && filteredThreads.some((t) => t.threadId === prev) ? prev : filteredThreads[0]!.threadId
    );
  }, [filteredThreads]);

  const activeThread = filteredThreads.find((x) => x.threadId === activeThreadId) ?? null;

  const openThreadMutation = useMutation({
    mutationFn: (threadId: string) => markBackofficeThreadAsRead(threadId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessages });
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessageUnreadCount });
    },
  });

  const createThreadMutation = useMutation({
    mutationFn: async () => {
      await createBackofficeMessage(targetWorkerUserId, {
        category: "DIRECT",
        title: newSubject.trim(),
        threadTitle: newSubject.trim(),
        body: newBody.trim(),
        payload: { kind: "thread_start" },
      });
    },
    onSuccess: async () => {
      setNewBody("");
      setNewSubject("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessages });
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessageUnreadCount });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      if (!activeThread?.counterpartId) return;
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

  const archiveMutation = useMutation({
    mutationFn: (threadId: string) => archiveBackofficeThreadForMe(threadId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessages });
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessageUnreadCount });
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: (threadId: string) => unarchiveBackofficeThreadForMe(threadId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessages });
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessageUnreadCount });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (threadId: string) => deleteBackofficeThreadForMe(threadId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessages });
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessageUnreadCount });
      setActiveThreadId(null);
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
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("admin.messages.admin_title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("admin.messages.admin_subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MailPlus className="h-4 w-4" />
            {t("admin.messages.admin_new_thread")}
          </CardTitle>
          <CardDescription>{t("admin.messages.admin_new_thread_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
            <Popover open={workerComboOpen} onOpenChange={setWorkerComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={workerComboOpen}
                  className={cn(
                    "w-full justify-between font-normal",
                    !targetWorkerUserId && "text-muted-foreground"
                  )}
                >
                  {selectedWorker
                    ? `${selectedWorker.firstName} ${selectedWorker.lastName}`.trim()
                    : t("admin.messages.admin_select_worker")}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[min(calc(100vw-2rem),32rem)]" align="start">
                <Command>
                  <CommandInput placeholder={t("admin.messages.admin_search_worker_placeholder")} />
                  <CommandList>
                    <CommandEmpty>{t("admin.messages.admin_search_worker_empty")}</CommandEmpty>
                    <CommandGroup>
                      {workerUsers.map((u) => (
                        <CommandItem
                          key={u.id}
                          value={workerSearchValue(u)}
                          onSelect={() => {
                            setTargetWorkerUserId(u.id);
                            setWorkerComboOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              targetWorkerUserId === u.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {`${u.firstName} ${u.lastName}`.trim()} · {u.email}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder={t("admin.messages.subject_placeholder")}
            />
          </div>
          <Textarea
            rows={4}
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder={t("admin.messages.body_placeholder")}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              className="gap-1.5"
              disabled={
                !targetWorkerUserId || !newSubject.trim() || !newBody.trim() || createThreadMutation.isPending
              }
              onClick={() => createThreadMutation.mutate()}
            >
              <Send className="h-4 w-4" />
              {t("admin.messages.send")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.messages.admin_threads_title")}</CardTitle>
          <CardDescription>
            {t("admin.common.showing")} {filteredThreads.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative max-w-lg flex-1 min-w-[260px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={threadQuery}
                onChange={(e) => setThreadQuery(e.target.value)}
                className="pl-9"
                placeholder={t("admin.messages.admin_search_threads_placeholder")}
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? t("admin.messages.filter_hide_archived") : t("admin.messages.filter_show_archived")}
            </Button>
          </div>
          {filteredThreads.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {threadQuery.trim()
                ? t("admin.messages.admin_threads_no_match")
                : t("admin.messages.admin_threads_empty")}
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[300px,1fr]">
              <div className="space-y-2 max-h-[72vh] overflow-y-auto pr-1">
                {filteredThreads.map((th) => (
                  <button
                    key={th.threadId}
                    type="button"
                    onClick={() => {
                      setActiveThreadId(th.threadId);
                      if (th.unreadCount > 0 && !openThreadMutation.isPending) {
                        openThreadMutation.mutate(th.threadId);
                      }
                    }}
                    className={`w-full text-left rounded-lg border px-3 py-2.5 space-y-1 ${
                      activeThreadId === th.threadId ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{th.title}</p>
                      <div className="flex items-center gap-1">
                        {th.archived ? <Badge variant="outline">{t("admin.messages.archived_badge")}</Badge> : null}
                        {th.unreadCount > 0 ? <Badge>{th.unreadCount}</Badge> : null}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{th.counterpartName}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDt(th.lastAt)}</p>
                  </button>
                ))}
              </div>

              {activeThread ? (
                <div className="rounded-lg border p-3 md:p-4 space-y-3">
                  <div className="border-b pb-2 space-y-2">
                    <div>
                      <p className="font-medium">{activeThread.title}</p>
                      <p className="text-xs text-muted-foreground">{activeThread.counterpartName}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {activeThread.archived ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={unarchiveMutation.isPending}
                          onClick={() => unarchiveMutation.mutate(activeThread.threadId)}
                          className="gap-1"
                        >
                          <ArchiveRestore className="h-3.5 w-3.5" />
                          {t("admin.messages.unarchive_thread")}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={archiveMutation.isPending}
                          onClick={() => archiveMutation.mutate(activeThread.threadId)}
                          className="gap-1"
                        >
                          <Archive className="h-3.5 w-3.5" />
                          {t("admin.messages.archive_thread")}
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-destructive"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(activeThread.threadId)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t("admin.messages.delete_thread")}
                      </Button>
                    </div>
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

export default AdminWorkerMessages;
