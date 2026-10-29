import { useState } from "react";
import { Check, Copy, FileDown, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import { reportToMarkdown, variationTrend } from "@/lib/ai/format";
import { downloadAiReportPdf } from "@/lib/ai/reportPdf";
import { cn } from "@/lib/utils";
import type { AiReport } from "@/types/ai";
import { AiMarkdown } from "@/components/ai/AiMarkdown";

type AiReportViewProps = {
  report: AiReport;
};

export function AiReportView({ report }: AiReportViewProps) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(reportToMarkdown(report));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* portapapeles no disponible */
    }
  };

  return (
    <Card className="border-primary/20 bg-card shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg leading-snug">{report.title}</CardTitle>
            {report.period ? <CardDescription className="mt-1">{report.period}</CardDescription> : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={copyMarkdown} className="gap-1.5">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span className="hidden sm:inline">{copied ? t("admin.ai.copied") : t("admin.ai.copy")}</span>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => downloadAiReportPdf(report)} className="gap-1.5">
              <FileDown className="h-4 w-4" />
              {t("admin.ai.export_pdf")}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm leading-relaxed text-foreground">{report.summary}</p>

        {report.kpis.length > 0 ? (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {report.kpis.map((k, i) => {
              const trend = variationTrend(k.variation);
              return (
                <div key={`${k.label}-${i}`} className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground line-clamp-2">
                    {k.label}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums leading-tight break-words">{k.value}</p>
                  {k.variation ? (
                    <p
                      className={cn(
                        "mt-1 inline-flex items-center gap-1 text-xs font-medium tabular-nums",
                        trend === "up" && "text-emerald-600 dark:text-emerald-400",
                        trend === "down" && "text-red-600 dark:text-red-400",
                        trend === "flat" && "text-muted-foreground"
                      )}
                    >
                      {trend === "up" ? <TrendingUp className="h-3.5 w-3.5" /> : null}
                      {trend === "down" ? <TrendingDown className="h-3.5 w-3.5" /> : null}
                      {k.variation}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {report.sections.map((s, i) => (
          <section key={`${s.title}-${i}`} className="space-y-1.5">
            <h4 className="text-sm font-semibold tracking-tight">{s.title}</h4>
            <AiMarkdown content={s.content} className="text-muted-foreground [&_strong]:text-foreground" />
          </section>
        ))}

        {(report.tables ?? []).map((tbl, i) => (
          <section key={`${tbl.title}-${i}`} className="space-y-1.5">
            <h4 className="text-sm font-semibold tracking-tight">{tbl.title}</h4>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {tbl.columns.map((c, ci) => (
                      <TableHead key={ci} className={cn("whitespace-nowrap", ci > 0 && "text-right")}>
                        {c}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tbl.rows.map((row, ri) => (
                    <TableRow key={ri}>
                      {tbl.columns.map((_, ci) => (
                        <TableCell key={ci} className={cn("tabular-nums", ci > 0 && "text-right")}>
                          {row[ci] ?? ""}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
