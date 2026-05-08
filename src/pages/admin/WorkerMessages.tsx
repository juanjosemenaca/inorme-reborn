import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Archive, ChevronDown, Loader2, MailPlus, Send } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMyBackofficeMessages } from "@/hooks/useBackofficeMessages";
import {
  createBackofficeMessage,
  createBackofficeMessagesToRecipients,
  markBackofficeThreadAsRead,
} from "@/api/backofficeMessagesApi";
import { queryKeys } from "@/lib/queryKeys";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useBackofficeUsers } from "@/hooks/useBackofficeUsers";
import { useProjects } from "@/hooks/useProjects";
import { useToast } from "@/hooks/use-toast";
import type { BackofficeMessageRecord } from "@/types/backofficeMessages";
import { DmsWorkerReviewPanel } from "@/components/admin/DmsWorkerReviewPanel";
import {
  backofficeUserIdsForProjectTeam,
  eligibleWorkerMessageRecipients,
  formatUserOptionLabel,
  projectsWhereCompanyWorkerParticipates,
} from "@/lib/messageRecipients";

type ComposeMode = "single" | "multi" | "project";

const WorkerMessages = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAdminAuth();
  const myUserId = user?.userId ?? "";
  const myCompanyWorkerId = user?.companyWorkerId ?? null;
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const threadFromUrl = searchParams.get("thread");
  const { data: users = [] } = useBackofficeUsers();
  const { data: projects = [] } = useProjects();
  const { data: messages = [], isLoading, isError, error } = useMyBackofficeMessages();
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const [composeMode, setComposeMode] = useState<ComposeMode>("single");
  const [singleRecipientId, setSingleRecipientId] = useState("");
  const [multiRecipientIds, setMultiRecipientIds] = useState<string[]>([]);
  const [composeProjectId, setComposeProjectId] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);

  const eligibleUsers = useMemo(
    () => eligibleWorkerMessageRecipients(users, myUserId),
    [users, myUserId]
  );

  const userOptions = useMemo(
    () =>
      eligibleUsers.map((u) => ({
        value: u.id,
        label: formatUserOptionLabel(u),
      })),
    [eligibleUsers]
  );

  const participatingProjects = useMemo(
    () => projectsWhereCompanyWorkerParticipates(projects, myCompanyWorkerId),
    [projects, myCompanyWorkerId]
  );

  const projectOptions = useMemo(
    () =>
      [...participatingProjects]
        .sort((a, b) => a.title.localeCompare(b.title, language === "en" ? "en" : "es"))
        .map((p) => ({
          value: p.id,
          label: `${p.projectCode} — ${p.title}`,
        })),
    [participatingProjects, language]
  );

  const selectedProject = useMemo(
    () =>
      composeProjectId
        ? participatingProjects.find((p) => p.id === composeProjectId) ?? null
        : null,
    [composeProjectId, participatingProjects]
  );

  const projectRecipientIds = useMemo(() => {
    if (!selectedProject) return [];
    return backofficeUserIdsForProjectTeam(selectedProject, users, myUserId);
  }, [selectedProject, users, myUserId]);

  const composeRecipientIds = useMemo((): string[] => {
    if (composeMode === "single") return singleRecipientId ? [singleRecipientId] : [];
    if (composeMode === "multi") return multiRecipientIds;
    return projectRecipientIds;
  }, [composeMode, singleRecipientId, multiRecipientIds, projectRecipientIds]);

  useEffect(() => {
    if (!composeProjectId) return;
    if (!participatingProjects.some((p) => p.id === composeProjectId)) {
      setComposeProjectId("");
    }
  }, [composeProjectId, participatingProjects]);

  const toggleMulti = (id: string) => {
    setMultiRecipientIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const setMode = (mode: ComposeMode) => {
    setComposeMode(mode);
    setSingleRecipientId("");
    setMultiRecipientIds([]);
    setComposeProjectId("");
  };

  const composeMutation = useMutation({
    mutationFn: async (): Promise<number> => {
      const title = composeSubject.trim();
      const body = composeBody.trim();
      const ids =
        composeMode === "single"
          ? singleRecipientId
            ? [singleRecipientId]
            : []
          : composeMode === "multi"
            ? [...multiRecipientIds]
            : projectRecipientIds;
      if (!title || !body || ids.length === 0) return 0;
      const payloadBase: Record<string, unknown> = {
        kind: "thread_start",
        composeMode,
      };
      if (composeMode === "project" && composeProjectId) {
        payloadBase.projectId = composeProjectId;
      }
      if (ids.length === 1) {
        await createBackofficeMessage(ids[0]!, {
          category: "DIRECT",
          title,
          threadTitle: title,
          body,
          payload: payloadBase,
        });
      } else {
        await createBackofficeMessagesToRecipients(ids, {
          category: "DIRECT",
          title,
          threadTitle: title,
          body,
          payload: payloadBase,
        });
      }
      return ids.length;
    },
    onSuccess: async (sentCount) => {
      if (sentCount < 1) return;
      toast({
        title:
          sentCount <= 1
            ? t("admin.messages.worker_compose_toast_sent_one")
            : t("admin.messages.worker_compose_toast_sent_many").replace(/\{\{count\}\}/g, String(sentCount)),
      });
      setComposeSubject("");
      setComposeBody("");
      setSingleRecipientId("");
      setMultiRecipientIds([]);
      setComposeProjectId("");
      setComposeOpen(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessages });
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessageUnreadCount });
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

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
        counterpartName: counterpartId
          ? userNameById.get(counterpartId) ?? t("admin.messages.user_unknown")
          : t("admin.messages.system"),
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
    if (threadFromUrl && threads.some((th) => th.threadId === threadFromUrl)) {
      setActiveThreadId(threadFromUrl);
      return;
    }
    setActiveThreadId((prev) => (prev && threads.some((th) => th.threadId === prev) ? prev : threads[0]!.threadId));
  }, [threads, threadFromUrl]);

  const activeThread = threads.find((x) => x.threadId === activeThreadId) ?? null;

  const dmsReviewIdFromThread = useMemo(() => {
    if (!activeThread) return null;
    for (const m of activeThread.messages) {
      const p = m.payload as Record<string, unknown>;
      if (p?.kind === "dms_document_review" && typeof p.reviewId === "string") return p.reviewId;
    }
    return null;
  }, [activeThread]);

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

  const canSendCompose =
    composeSubject.trim().length > 0 &&
    composeBody.trim().length > 0 &&
    composeRecipientIds.length > 0 &&
    !composeMutation.isPending;

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
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bell className="h-6 w-6 text-primary" aria-hidden />
          {t("admin.messages.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t("admin.messages.subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="py-3 px-6 space-y-0">
          <button
            type="button"
            onClick={() => setComposeOpen((o) => !o)}
            aria-expanded={composeOpen}
            className="flex w-full items-center justify-between gap-3 rounded-md text-left outline-none ring-offset-background hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 -mx-2 px-2 py-1.5"
          >
            <div className="flex items-center gap-2 min-w-0">
              <MailPlus className="h-4 w-4 text-primary shrink-0" aria-hidden />
              <div className="min-w-0 space-y-0.5">
                <span className="font-semibold text-base leading-tight block">
                  {t("admin.messages.worker_compose_title")}
                </span>
                {!composeOpen ? (
                  <span className="text-sm text-muted-foreground line-clamp-2">
                    {t("admin.messages.worker_compose_collapsed_hint")}
                  </span>
                ) : null}
              </div>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                composeOpen && "rotate-180"
              )}
              aria-hidden
            />
          </button>
        </CardHeader>
        {composeOpen ? (
          <CardContent className="space-y-4 pt-0">
            <CardDescription>{t("admin.messages.worker_compose_desc")}</CardDescription>
            <RadioGroup
            value={composeMode}
            onValueChange={(v) => setMode(v as ComposeMode)}
            className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="single" id="cm-single" />
              <Label htmlFor="cm-single" className="font-normal cursor-pointer">
                {t("admin.messages.worker_compose_mode_single")}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="multi" id="cm-multi" />
              <Label htmlFor="cm-multi" className="font-normal cursor-pointer">
                {t("admin.messages.worker_compose_mode_multi")}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="project" id="cm-project" />
              <Label htmlFor="cm-project" className="font-normal cursor-pointer">
                {t("admin.messages.worker_compose_mode_project")}
              </Label>
            </div>
          </RadioGroup>

          {composeMode === "single" ? (
            <div className="space-y-1.5 max-w-md">
              <Label>{t("admin.messages.worker_compose_pick_user")}</Label>
              <SearchableSelect
                value={singleRecipientId}
                onValueChange={setSingleRecipientId}
                options={userOptions}
                placeholder={t("admin.messages.admin_select_worker")}
                searchPlaceholder={t("admin.messages.admin_search_worker_placeholder")}
                emptyText={t("admin.messages.admin_search_worker_empty")}
                disabled={eligibleUsers.length === 0}
              />
            </div>
          ) : null}

          {composeMode === "multi" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("admin.messages.worker_compose_pick_users_hint")}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setMultiRecipientIds(eligibleUsers.filter((u) => u.role === "ADMIN").map((u) => u.id))
                  }
                >
                  {t("admin.messages.worker_compose_preset_admins")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setMultiRecipientIds(eligibleUsers.filter((u) => u.role === "WORKER").map((u) => u.id))
                  }
                >
                  {t("admin.messages.worker_compose_preset_workers")}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setMultiRecipientIds([])}>
                  {t("admin.messages.worker_compose_clear_selection")}
                </Button>
              </div>
              <ScrollArea className="h-48 rounded-md border p-3">
                <ul className="space-y-2 pr-3">
                  {eligibleUsers.map((u) => (
                    <li key={u.id}>
                      <label className="flex items-start gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={multiRecipientIds.includes(u.id)}
                          onCheckedChange={() => toggleMulti(u.id)}
                          className="mt-0.5"
                        />
                        <span>{formatUserOptionLabel(u)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
              <p className="text-xs text-muted-foreground">
                {t("admin.messages.worker_compose_selected_count").replace(
                  /\{\{count\}\}/g,
                  String(multiRecipientIds.length)
                )}
              </p>
            </div>
          ) : null}

          {composeMode === "project" ? (
            <div className="space-y-2 max-w-xl">
              <Label>{t("admin.messages.worker_compose_pick_project")}</Label>
              <SearchableSelect
                value={composeProjectId}
                onValueChange={setComposeProjectId}
                options={projectOptions}
                placeholder={t("admin.messages.worker_compose_project_placeholder")}
                searchPlaceholder={t("admin.projects.search_ph")}
                emptyText={t("admin.projects.empty_filter")}
                disabled={participatingProjects.length === 0}
              />
              <p className="text-xs text-muted-foreground">{t("admin.messages.worker_compose_project_hint")}</p>
              {participatingProjects.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("admin.messages.worker_compose_no_projects")}</p>
              ) : null}
              {composeProjectId && projectRecipientIds.length === 0 ? (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  {t("admin.messages.worker_compose_no_recipients")}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-1 max-w-2xl">
            <div className="space-y-1.5">
              <Label htmlFor="worker-msg-subject">{t("admin.messages.subject_placeholder")}</Label>
              <Input
                id="worker-msg-subject"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder={t("admin.messages.subject_placeholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="worker-msg-body">{t("admin.messages.body_placeholder")}</Label>
              <Textarea
                id="worker-msg-body"
                rows={4}
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder={t("admin.messages.body_placeholder")}
              />
            </div>
          </div>

          <Button type="button" disabled={!canSendCompose} onClick={() => composeMutation.mutate()}>
            {composeMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t("admin.messages.worker_compose_sending")}
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {t("admin.messages.worker_compose_send")}
              </>
            )}
          </Button>
          </CardContent>
        ) : null}
      </Card>

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
                      setSearchParams(
                        (prev) => {
                          const p = new URLSearchParams(prev);
                          p.set("thread", th.threadId);
                          return p;
                        },
                        { replace: true }
                      );
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
                  {dmsReviewIdFromThread ? (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                      <p className="text-xs font-semibold flex items-center gap-2">
                        <Archive className="h-4 w-4" aria-hidden />
                        {t("admin.dms.worker_embed_title")}
                      </p>
                      <DmsWorkerReviewPanel
                        reviewId={dmsReviewIdFromThread}
                        onUpdated={async () => {
                          await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessages });
                          await queryClient.invalidateQueries({ queryKey: queryKeys.myDmsDocumentReviews });
                        }}
                      />
                    </div>
                  ) : null}

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
