import { useCallback, useMemo, useState } from "react";
import { Eraser, MessageSquarePlus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  useAiConversations,
  useAiMessages,
  useDeleteAiConversation,
  useSendAiMessage,
} from "@/hooks/useAiAssistant";
import { aiAvailableAreas } from "@/lib/ai/aiAccess";
import { cn } from "@/lib/utils";
import type { AiMessageModel } from "@/types/ai";
import type { WorkerModuleKey } from "@/types/backoffice";
import { AiChat } from "@/components/ai/AiChat";

const SUGGESTION_KEYS: { key: string; module: WorkerModuleKey }[] = [
  { key: "admin.ai.suggest_billing_month", module: "FACTURACION" },
  { key: "admin.ai.suggest_compare_months", module: "FACTURACION" },
  { key: "admin.ai.suggest_top_clients", module: "FACTURACION" },
  { key: "admin.ai.suggest_chart_clients", module: "FACTURACION" },
  { key: "admin.ai.suggest_pending_invoices", module: "FACTURACION" },
  { key: "admin.ai.suggest_monthly_report", module: "FACTURACION" },
  { key: "admin.ai.suggest_expenses", module: "GASTOS" },
  { key: "admin.ai.suggest_projects", module: "ADMIN_PROJECTS" },
  { key: "admin.ai.suggest_clients", module: "ADMIN_CLIENTS" },
];

type LocalExchange = {
  conversationId: string | null;
  user: AiMessageModel;
  assistant: AiMessageModel;
};

/**
 * Pantalla del Asistente IA: lista de conversaciones + chat.
 * Toda la autorización real ocurre en la Edge Function; aquí solo UI.
 */
export function AiAssistant() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { role, user } = useAdminAuth();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [local, setLocal] = useState<LocalExchange | null>(null);
  const [lastText, setLastText] = useState<string>("");

  const conversations = useAiConversations();
  const history = useAiMessages(activeId);
  const send = useSendAiMessage();
  const remove = useDeleteAiConversation();

  const areas = useMemo(() => aiAvailableAreas(role, user?.enabledModules), [role, user?.enabledModules]);
  const suggestions = useMemo(
    () => SUGGESTION_KEYS.filter((s) => areas.includes(s.module)).map((s) => t(s.key)),
    [areas, t]
  );

  const historyData = history.data;
  const messages: AiMessageModel[] = useMemo(() => {
    const serverMessages = historyData ?? [];
    if (!local) return serverMessages;
    if (local.conversationId !== activeId) return serverMessages;
    return [...serverMessages, local.user, local.assistant];
  }, [historyData, local, activeId]);

  const doSend = useCallback(
    (text: string) => {
      const now = new Date().toISOString();
      const convAtSend = activeId;
      setLastText(text);
      setLocal({
        conversationId: convAtSend,
        user: { id: `local-user-${now}`, role: "user", content: text, createdAt: now },
        assistant: { id: `local-asst-${now}`, role: "assistant", content: "", createdAt: now, pending: true },
      });
      send.mutate(
        { message: text, conversationId: convAtSend },
        {
          onSuccess: (res) => {
            setLocal(null);
            if (res.conversationId !== convAtSend) setActiveId(res.conversationId);
          },
          onError: (err) => {
            const message = err instanceof Error && err.message ? err.message : t("admin.ai.error_generic");
            setLocal((prev) =>
              prev
                ? { ...prev, assistant: { ...prev.assistant, pending: false, error: message } }
                : prev
            );
            toast({ variant: "destructive", title: t("admin.ai.title"), description: message });
          },
        }
      );
    },
    [activeId, send, t, toast]
  );

  const startNew = () => {
    setActiveId(null);
    setLocal(null);
  };

  const selectConversation = (id: string) => {
    setActiveId(id);
    setLocal(null);
  };

  const deleteConversation = (id: string) => {
    remove.mutate(id, {
      onSuccess: () => {
        if (activeId === id) startNew();
      },
      onError: () => toast({ variant: "destructive", title: t("admin.ai.title"), description: t("admin.ai.error_generic") }),
    });
  };

  const busy = send.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Sparkles className="h-6 w-6 text-primary" aria-hidden />
            {t("admin.ai.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("admin.ai.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={startNew} disabled={busy} className="gap-1.5">
            <Eraser className="h-4 w-4" />
            {t("admin.ai.clear")}
          </Button>
          <Button type="button" size="sm" onClick={startNew} disabled={busy} className="gap-1.5">
            <MessageSquarePlus className="h-4 w-4" />
            {t("admin.ai.new_conversation")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <Card className="hidden lg:flex lg:flex-col lg:h-[calc(100dvh-11rem)] lg:min-h-[520px]">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-semibold">{t("admin.ai.conversations")}</span>
            <Badge variant="secondary" className="tabular-nums">
              {conversations.data?.length ?? 0}
            </Badge>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <ul className="p-2">
              {(conversations.data ?? []).length === 0 ? (
                <li className="px-2 py-6 text-center text-xs text-muted-foreground">{t("admin.ai.no_conversations")}</li>
              ) : null}
              {(conversations.data ?? []).map((c) => {
                const active = c.id === activeId;
                return (
                  <li key={c.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => selectConversation(c.id)}
                      className={cn(
                        "w-full rounded-md px-3 py-2 pr-9 text-left text-sm transition-colors",
                        active ? "bg-secondary font-semibold text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <span className="line-clamp-2">{c.title}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteConversation(c.id)}
                      aria-label={t("admin.ai.delete_conversation")}
                      title={t("admin.ai.delete_conversation")}
                      className="absolute right-1.5 top-1.5 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </Card>

        <Card className="flex h-[calc(100dvh-11rem)] min-h-[520px] flex-col overflow-hidden">
          <AiChat
            messages={messages}
            loadingHistory={!!activeId && history.isLoading}
            busy={busy}
            suggestions={suggestions}
            onSend={doSend}
            onRetry={lastText ? () => doSend(lastText) : undefined}
          />
        </Card>
      </div>
    </div>
  );
}
