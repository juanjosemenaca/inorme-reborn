import { AlertCircle, Bot, RotateCcw, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { chartCompanionText } from "@/lib/ai/charts";
import { formatTimeEs } from "@/lib/ai/format";
import { cn } from "@/lib/utils";
import type { AiMessageModel } from "@/types/ai";
import { AiChartView } from "@/components/ai/AiChartView";
import { AiMarkdown } from "@/components/ai/AiMarkdown";
import { AiReportView } from "@/components/ai/AiReportView";

const TOOL_LABEL_KEYS: Record<string, string> = {
  get_billing_summary: "admin.ai.tool_billing",
  get_top_clients_by_billing: "admin.ai.tool_billing",
  get_pending_invoices: "admin.ai.tool_billing",
  get_invoice_list: "admin.ai.tool_billing",
  get_billing_comparison: "admin.ai.tool_billing",
  get_client_billing_comparison: "admin.ai.tool_billing",
  get_expenses_summary: "admin.ai.tool_expenses",
  get_top_expense_categories: "admin.ai.tool_expenses",
  get_projects_summary: "admin.ai.tool_projects",
  get_project_performance: "admin.ai.tool_projects",
  get_clients_summary: "admin.ai.tool_clients",
  get_data_catalog: "admin.ai.tool_catalog",
};

type AiMessageProps = {
  message: AiMessageModel;
  /** Texto de estado mientras el asistente trabaja (solo si `pending`). */
  statusLabel?: string;
  onRetry?: () => void;
};

export function AiMessage({ message, statusLabel, onRetry }: AiMessageProps) {
  const { t } = useLanguage();
  const isUser = message.role === "user";
  const areas = Array.from(
    new Set((message.toolsUsed ?? []).map((name) => TOOL_LABEL_KEYS[name]).filter((k): k is string => !!k))
  ).map((k) => t(k));
  const caption =
    !isUser && !message.report && message.content
      ? message.charts?.length
        ? chartCompanionText(message.content, message.charts)
        : message.content
      : "";
  const showCaption = Boolean(caption) && caption !== "Gráfico generado a partir de los datos de Inorme.";

  return (
    <div className={cn("flex gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
        )}
        aria-hidden
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className={cn("min-w-0 space-y-1.5", isUser ? "max-w-[85%] items-end text-right" : "w-full max-w-[min(100%,56rem)]")}>
        <p className="text-[11px] font-medium text-muted-foreground">
          {isUser ? t("admin.ai.you") : t("admin.ai.assistant")}
          {message.createdAt && !message.pending ? (
            <span className="ml-1.5 font-normal opacity-70">{formatTimeEs(message.createdAt)}</span>
          ) : null}
        </p>

        {isUser ? (
          <div className="inline-block rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-left text-sm leading-relaxed text-primary-foreground whitespace-pre-wrap">
            {message.content}
          </div>
        ) : message.pending ? (
          <div className="inline-flex items-center gap-2.5 rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 animate-pulse text-primary" aria-hidden />
            <span>{statusLabel ?? t("admin.ai.status_analyzing")}</span>
          </div>
        ) : message.error ? (
          <div className="space-y-2 rounded-2xl rounded-tl-sm border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
            <p className="flex items-start gap-2 text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{message.error}</span>
            </p>
            {onRetry ? (
              <Button type="button" size="sm" variant="outline" onClick={onRetry} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                {t("admin.ai.retry")}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {message.report ? <AiReportView report={message.report} /> : null}
            {showCaption ? (
              <div className="rounded-2xl rounded-tl-sm bg-muted/70 px-4 py-3">
                <AiMarkdown content={caption} />
              </div>
            ) : null}
            {(message.charts ?? []).map((chart, i) => (
              <AiChartView key={`${chart.title}-${i}`} chart={chart} />
            ))}
            {areas.length > 0 ? (
              <p className="text-[11px] text-muted-foreground">
                {t("admin.ai.sources_prefix")} {areas.join(" · ")}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
