import type { DashboardWidget } from "@/types/dashboard";

/** Abrir el dashboard no debe disparar el modelo. */
export const AI_REPORT_AUTO_FETCH = false;

export function cachedReportFromWidget(widget: DashboardWidget): { content: string; generatedAt: string | null } | null {
  if (widget.type !== "AI_REPORT") return null;
  if (widget.reportStatus !== "ready") return null;
  const content = widget.reportContent?.trim() ?? "";
  if (!content) return null;
  return { content, generatedAt: widget.reportGeneratedAt };
}

export function buildAiReportMessage(widget: DashboardWidget): string {
  const prompt = widget.config.prompt?.trim() ?? "";
  return `${prompt}\nPeríodo del widget: ${widget.config.period ?? "current_month"}.`;
}
