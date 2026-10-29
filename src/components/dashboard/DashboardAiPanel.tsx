import { useState } from "react";
import { Loader2, Sparkles, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSendAiMessage } from "@/hooks/useAiAssistant";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { AiMarkdown } from "@/components/ai/AiMarkdown";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUndo: () => void;
  canUndo: boolean;
  beforeSend: () => Promise<void>;
};

export function DashboardAiPanel({ open, onOpenChange, onUndo, canUndo, beforeSend }: Props) {
  const { t } = useLanguage();
  const send = useSendAiMessage();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [log, setLog] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [pendingApply, setPendingApply] = useState(false);

  const run = async (message: string, fromPreview = false) => {
    if (!message.trim() || send.isPending) return;
    if (!fromPreview) {
      setLog((l) => [...l, { role: "user", content: message }]);
      await beforeSend();
    }
    send.mutate(
      { message, intent: "dashboard" },
      {
        onSuccess: (res) => {
          setLog((l) => [...l, { role: "assistant", content: res.reply }]);
          setPendingApply(res.toolsUsed.includes("propose_dashboard_layout"));
          void qc.invalidateQueries({ queryKey: queryKeys.dashboardWidgets });
        },
        onError: (e) => {
          setPendingApply(false);
          setLog((l) => [...l, { role: "assistant", content: e instanceof Error ? e.message : t("admin.ai.error_generic") }]);
        },
      }
    );
  };

  const submit = async () => {
    const message = text.trim();
    if (!message) return;
    setText("");
    await run(message);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {t("admin.dashboard.customize_ai")}
          </SheetTitle>
          <SheetDescription>{t("admin.dashboard.ai_hint")}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-4 text-sm">
          {log.length === 0 ? <p className="text-muted-foreground">{t("admin.dashboard.ai_empty")}</p> : null}
          {log.map((m, i) => (
            <div key={i} className={m.role === "user" ? "rounded-lg bg-primary px-3 py-2 text-primary-foreground" : "rounded-lg bg-muted px-3 py-2"}>
              {m.role === "assistant" ? <AiMarkdown content={m.content} /> : m.content}
            </div>
          ))}
          {pendingApply ? (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setPendingApply(false);
                  void run("Aplica el plan propuesto", true);
                }}
              >
                {t("admin.dashboard.apply")}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setPendingApply(false)}>
                {t("admin.common.cancel")}
              </Button>
            </div>
          ) : null}
        </div>
        <div className="space-y-2 border-t pt-3">
          {canUndo ? (
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onUndo}>
              <Undo2 className="h-4 w-4" />
              {t("admin.dashboard.undo")}
            </Button>
          ) : null}
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={t("admin.dashboard.ai_placeholder")} />
          <Button type="button" onClick={() => void submit()} disabled={send.isPending || !text.trim()} className="w-full gap-1.5">
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {t("admin.ai.send")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
