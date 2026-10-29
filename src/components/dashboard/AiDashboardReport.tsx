import { Loader2, RefreshCw } from "lucide-react";
import { sendAiMessage } from "@/api/aiAssistantApi";
import { AiMarkdown } from "@/components/ai/AiMarkdown";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardMutations } from "@/hooks/useDashboard";
import { buildAiReportMessage, cachedReportFromWidget } from "@/lib/dashboard/aiReport";
import type { DashboardWidget } from "@/types/dashboard";

/** Muestra el resultado cacheado. La IA solo corre al pulsar actualizar (o un scheduler futuro). */
export function AiDashboardReport({ widget }: { widget: DashboardWidget }) {
  const { t } = useLanguage();
  const mut = useDashboardMutations();
  const prompt = widget.config.prompt ?? "";
  const cached = cachedReportFromWidget(widget);

  const refresh = async () => {
    if (!prompt.trim() || mut.saveReport.isPending) return;
    try {
      const res = await sendAiMessage({ message: buildAiReportMessage(widget) });
      await mut.saveReport.mutateAsync({ id: widget.id, content: res.reply, status: "ready" });
    } catch {
      await mut.saveReport.mutateAsync({
        id: widget.id,
        content: widget.reportContent ?? "",
        status: "error",
      });
    }
  };

  if (!prompt) return <p className="text-sm text-muted-foreground">{t("admin.dashboard.report_missing_prompt")}</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {cached?.generatedAt
            ? t("admin.dashboard.report_generated_at").replace(
                "{{date}}",
                new Date(cached.generatedAt).toLocaleString()
              )
            : t("admin.dashboard.report_empty")}
        </p>
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => void refresh()} disabled={mut.saveReport.isPending}>
          {mut.saveReport.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {t("admin.dashboard.report_refresh")}
        </Button>
      </div>
      {mut.saveReport.isPending ? (
        <p className="text-sm text-muted-foreground">{t("admin.dashboard.report_generating")}</p>
      ) : widget.reportStatus === "error" ? (
        <p className="text-sm text-destructive">{t("admin.dashboard.report_error")}</p>
      ) : cached ? (
        <AiMarkdown content={cached.content} />
      ) : (
        <p className="text-sm text-muted-foreground">{t("admin.dashboard.report_empty")}</p>
      )}
    </div>
  );
}
