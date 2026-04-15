import { useMemo, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useCompanyWorkers } from "@/hooks/useCompanyWorkers";
import { useWorkersTimeClockEvents } from "@/hooks/useTimeTracking";
import { computeDailyTimeSummaries } from "@/api/timeTrackingApi";
import { getErrorMessage } from "@/lib/errorMessage";
import { jsPDF } from "jspdf";

type PeriodPreset = "LAST_30" | "THIS_MONTH" | "THIS_YEAR" | "CUSTOM";

function dateToIsoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function firstDayOfMonth(now: Date): string {
  return dateToIsoLocal(new Date(now.getFullYear(), now.getMonth(), 1));
}

function firstDayOfYear(now: Date): string {
  return dateToIsoLocal(new Date(now.getFullYear(), 0, 1));
}

function resolvePresetRange(preset: PeriodPreset): { from: string; to: string } {
  const now = new Date();
  const to = dateToIsoLocal(now);
  if (preset === "THIS_MONTH") return { from: firstDayOfMonth(now), to };
  if (preset === "THIS_YEAR") return { from: firstDayOfYear(now), to };
  const from = new Date(now);
  from.setDate(now.getDate() - 30);
  return { from: dateToIsoLocal(from), to };
}

const AdminTimeClockReports = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const workersQuery = useCompanyWorkers();
  const workers = useMemo(() => (workersQuery.data ?? []).filter((w) => w.active), [workersQuery.data]);

  const [preset, setPreset] = useState<PeriodPreset>("LAST_30");
  const presetRange = useMemo(() => resolvePresetRange(preset), [preset]);
  const [fromDate, setFromDate] = useState(presetRange.from);
  const [toDate, setToDate] = useState(presetRange.to);
  const [allWorkers, setAllWorkers] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const effectiveFrom = preset === "CUSTOM" ? fromDate : presetRange.from;
  const effectiveTo = preset === "CUSTOM" ? toDate : presetRange.to;
  const workerIds = useMemo(() => (allWorkers ? workers.map((w) => w.id) : selectedIds), [allWorkers, workers, selectedIds]);

  const eventsQuery = useWorkersTimeClockEvents(workerIds, effectiveFrom, effectiveTo, workerIds.length > 0);
  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);

  const reportRows = useMemo(() => {
    const map = new Map(
      workers.map((w) => [w.id, { name: `${w.firstName} ${w.lastName}`.trim(), minutes: 0, absences: [] as string[] }] as const)
    );
    const eventsByWorker = new Map<string, typeof events>();
    for (const e of events) {
      if (!eventsByWorker.has(e.companyWorkerId)) eventsByWorker.set(e.companyWorkerId, []);
      eventsByWorker.get(e.companyWorkerId)!.push(e);
    }
    for (const [workerId, workerEvents] of eventsByWorker.entries()) {
      const daily = computeDailyTimeSummaries(workerEvents);
      const row = map.get(workerId);
      if (!row) continue;
      row.minutes = daily.reduce((acc, d) => acc + d.workedMinutes, 0);
      row.absences = daily
        .filter((d) => d.hasAbsence)
        .map((d) => `${d.dayIso}${d.absenceReason ? ` (${d.absenceReason})` : ""}`);
    }

    const filtered = workerIds
      .map((id) => ({ id, ...map.get(id) }))
      .filter((x): x is { id: string; name: string; minutes: number; absences: string[] } => !!x);
    return filtered;
  }, [events, workerIds, workers]);

  const totalHours = useMemo(
    () => reportRows.reduce((acc, r) => acc + r.minutes, 0) / 60,
    [reportRows]
  );
  const totalAbsences = useMemo(
    () => reportRows.reduce((acc, r) => acc + r.absences.length, 0),
    [reportRows]
  );

  const localeTag = language === "en" ? "en-GB" : language === "ca" ? "ca-ES" : "es-ES";
  const nowStamp = new Date().toLocaleString(localeTag, { dateStyle: "short", timeStyle: "short" });

  const toggleWorker = (workerId: string) => {
    setSelectedIds((prev) =>
      prev.includes(workerId) ? prev.filter((id) => id !== workerId) : [...prev, workerId]
    );
  };

  const dateRangeValid = effectiveFrom <= effectiveTo;
  const [pdfExporting, setPdfExporting] = useState(false);

  const exportPdf = async () => {
    if (!dateRangeValid || pdfExporting) return;
    setPdfExporting(true);
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
      const pageMaxY = 285;
      const marginX = 14;
      const maxWidth = 182;
      let y = 14;

      const ensureSpace = (needed: number) => {
        if (y + needed > pageMaxY) {
          doc.addPage();
          y = marginX;
        }
      };

      const addBlock = (text: string, size: number, fontStyle: "normal" | "bold" = "normal") => {
        doc.setFont("helvetica", fontStyle);
        doc.setFontSize(size);
        const lines = doc.splitTextToSize(text, maxWidth);
        const lineHeight = size * 0.45 + 1.5;
        for (const line of lines) {
          ensureSpace(lineHeight);
          doc.text(line, marginX, y);
          y += lineHeight;
        }
      };

      addBlock(t("admin.timeClock.reports_pdf_title"), 14, "bold");
      addBlock(`${t("admin.timeClock.reports_pdf_generated_at")} ${nowStamp}`, 10);
      addBlock(
        `${t("admin.timeClock.reports_from")}: ${effectiveFrom}  ${t("admin.timeClock.reports_to")}: ${effectiveTo}`,
        10
      );
      addBlock(`${t("admin.timeClock.reports_total_hours")}: ${totalHours.toFixed(2)}`, 10);
      addBlock(`${t("admin.timeClock.reports_total_absences")}: ${totalAbsences}`, 10);
      y += 2;
      ensureSpace(8);

      if (reportRows.length === 0) {
        addBlock(t("admin.timeClock.reports_empty"), 10);
      } else {
        addBlock(t("admin.timeClock.reports_workers_section"), 11, "bold");
        for (const row of reportRows) {
          addBlock(
            `${row.name} — ${t("admin.timeClock.reports_hours_short")}: ${(row.minutes / 60).toFixed(2)} — ${t("admin.timeClock.reports_absences_short")}: ${row.absences.length}`,
            10
          );
        }
        y += 2;
        ensureSpace(8);

        addBlock(t("admin.timeClock.reports_absences_section"), 11, "bold");
        const rowsWithAbs = reportRows.filter((r) => r.absences.length > 0);
        if (rowsWithAbs.length === 0) {
          addBlock(t("admin.timeClock.reports_no_absences"), 10);
        } else {
          for (const row of rowsWithAbs) {
            addBlock(row.name, 10, "bold");
            for (const absence of row.absences) {
              addBlock(`- ${absence}`, 10);
            }
          }
        }
      }

      const filename = `informe-fichajes-${effectiveFrom}_${effectiveTo}.pdf`;
      doc.save(filename);
    } catch (e) {
      toast({
        title: t("admin.common.error"),
        description: getErrorMessage(e) || t("admin.timeClock.reports_export_pdf_error"),
        variant: "destructive",
      });
    } finally {
      setPdfExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          {t("admin.timeClock.reports_title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t("admin.timeClock.reports_subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.timeClock.reports_filters_title")}</CardTitle>
          <CardDescription>{t("admin.timeClock.reports_filters_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Button type="button" variant={preset === "LAST_30" ? "default" : "outline"} onClick={() => setPreset("LAST_30")}>
              {t("admin.timeClock.reports_period_last_30")}
            </Button>
            <Button type="button" variant={preset === "THIS_MONTH" ? "default" : "outline"} onClick={() => setPreset("THIS_MONTH")}>
              {t("admin.timeClock.reports_period_this_month")}
            </Button>
            <Button type="button" variant={preset === "THIS_YEAR" ? "default" : "outline"} onClick={() => setPreset("THIS_YEAR")}>
              {t("admin.timeClock.reports_period_this_year")}
            </Button>
            <Button type="button" variant={preset === "CUSTOM" ? "default" : "outline"} onClick={() => setPreset("CUSTOM")}>
              {t("admin.timeClock.reports_period_custom")}
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("admin.timeClock.reports_from")}</Label>
              <Input
                type="date"
                value={preset === "CUSTOM" ? fromDate : effectiveFrom}
                onChange={(e) => {
                  setPreset("CUSTOM");
                  setFromDate(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("admin.timeClock.reports_to")}</Label>
              <Input
                type="date"
                value={preset === "CUSTOM" ? toDate : effectiveTo}
                onChange={(e) => {
                  setPreset("CUSTOM");
                  setToDate(e.target.value);
                }}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("admin.timeClock.reports_range_label")} {effectiveFrom} - {effectiveTo}
          </p>

          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allWorkers}
                onChange={(e) => setAllWorkers(e.target.checked)}
              />
              {t("admin.timeClock.reports_all_workers")}
            </label>
            {!allWorkers ? (
              <div className="rounded-md border p-3 max-h-48 overflow-y-auto grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {workers.map((w) => (
                  <label key={w.id} className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(w.id)}
                      onChange={() => toggleWorker(w.id)}
                    />
                    {`${w.firstName} ${w.lastName}`.trim()}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {eventsQuery.isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          {t("admin.common.loading")}
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("admin.timeClock.reports_result_title")}</CardTitle>
            <CardDescription>
              {t("admin.timeClock.reports_total_hours")}: {totalHours.toFixed(2)} · {t("admin.timeClock.reports_total_absences")}: {totalAbsences}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.timeClock.reports_col_worker")}</TableHead>
                    <TableHead className="text-right">{t("admin.timeClock.reports_col_hours")}</TableHead>
                    <TableHead className="text-right">{t("admin.timeClock.reports_col_absences")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        {t("admin.timeClock.reports_empty")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    reportRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{(row.minutes / 60).toFixed(2)}</TableCell>
                        <TableCell className="text-right">{row.absences.length}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">{t("admin.timeClock.reports_absences_section")}</p>
              {reportRows.every((r) => r.absences.length === 0) ? (
                <p className="text-sm text-muted-foreground">{t("admin.timeClock.reports_no_absences")}</p>
              ) : (
                reportRows.map((row) =>
                  row.absences.length > 0 ? (
                    <div key={`${row.id}-abs`} className="rounded-md border p-3 space-y-2">
                      <p className="text-sm font-medium">{row.name}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {row.absences.map((a) => (
                          <Badge key={a} variant="outline">
                            {a}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null
                )
              )}
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                className="gap-1.5"
                disabled={!dateRangeValid || pdfExporting}
                onClick={() => void exportPdf()}
              >
                {pdfExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {t("admin.timeClock.reports_export_pdf")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminTimeClockReports;
