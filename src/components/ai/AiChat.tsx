import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { AiMessageModel } from "@/types/ai";
import { AiMessage } from "@/components/ai/AiMessage";

export const AI_MESSAGE_MAX_CHARS = 2000;

const STATUS_KEYS = [
  "admin.ai.status_analyzing",
  "admin.ai.status_querying",
  "admin.ai.status_results",
  "admin.ai.status_report",
] as const;

type AiChatProps = {
  messages: AiMessageModel[];
  loadingHistory?: boolean;
  busy: boolean;
  suggestions: string[];
  onSend: (text: string) => void;
  onRetry?: () => void;
};

function useRotatingStatus(active: boolean): string {
  const { t } = useLanguage();
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!active) {
      setIdx(0);
      return;
    }
    const id = window.setInterval(() => setIdx((i) => Math.min(i + 1, STATUS_KEYS.length - 1)), 2500);
    return () => window.clearInterval(id);
  }, [active]);
  return t(STATUS_KEYS[idx]);
}

export function AiChat({ messages, loadingHistory = false, busy, suggestions, onSend, onRetry }: AiChatProps) {
  const { t } = useLanguage();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const statusLabel = useRotatingStatus(busy);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length, busy]);

  const submit = () => {
    const text = input.trim();
    if (!text || busy || text.length > AI_MESSAGE_MAX_CHARS) return;
    onSend(text);
    setInput("");
    textareaRef.current?.focus();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const tooLong = input.length > AI_MESSAGE_MAX_CHARS;
  const empty = messages.length === 0 && !loadingHistory;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-5">
          {loadingHistory ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("admin.common.loading")}
            </div>
          ) : null}

          {empty ? (
            <div className="space-y-6 py-6">
              <div className="space-y-2 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="h-6 w-6" aria-hidden />
                </div>
                <h2 className="text-lg font-semibold tracking-tight">{t("admin.ai.welcome_title")}</h2>
                <p className="mx-auto max-w-xl text-sm text-muted-foreground">{t("admin.ai.welcome_body")}</p>
              </div>
              {suggestions.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onSend(s)}
                      disabled={busy}
                      className="rounded-lg border bg-card px-4 py-3 text-left text-sm transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {messages.map((m) => (
            <AiMessage
              key={m.id}
              message={m}
              statusLabel={m.pending ? statusLabel : undefined}
              onRetry={m.error ? onRetry : undefined}
            />
          ))}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="border-t bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto w-full max-w-4xl">
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("admin.ai.placeholder")}
              disabled={busy}
              rows={2}
              aria-label={t("admin.ai.placeholder")}
              className="min-h-[48px] max-h-40 resize-y"
            />
            <Button
              type="submit"
              size="icon"
              disabled={busy || !input.trim() || tooLong}
              aria-label={t("admin.ai.send")}
              className="h-10 w-10 shrink-0"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{t("admin.ai.composer_hint")}</span>
            <span className={cn("tabular-nums", tooLong && "font-semibold text-destructive")}>
              {input.length}/{AI_MESSAGE_MAX_CHARS}
            </span>
          </div>
        </div>
      </form>
    </div>
  );
}
