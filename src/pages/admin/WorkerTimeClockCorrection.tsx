import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMyTimeClockEvents } from "@/hooks/useTimeTracking";
import { computeDailyTimeSummaries, requestTimeClockCorrection } from "@/api/timeTrackingApi";
import { useToast } from "@/hooks/use-toast";
import { todayIso, timeClockKindLabel } from "@/pages/admin/workerTimeClockShared";

const WorkerTimeClockCorrection = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [correctionMessage, setCorrectionMessage] = useState("");
  const [correctionDate, setCorrectionDate] = useState(todayIso());
  const localeTag = language === "en" ? "en-GB" : language === "ca" ? "ca-ES" : "es-ES";
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" });

  const { data: correctionDayEvents = [], isLoading, isError, error } = useMyTimeClockEvents(
    correctionDate || todayIso(),
    correctionDate || todayIso(),
    Boolean(correctionDate)
  );
  const correctionDaySummary = useMemo(
    () => computeDailyTimeSummaries(correctionDayEvents)[0] ?? null,
    [correctionDayEvents]
  );

  const correctionMutation = useMutation({
    mutationFn: () =>
      requestTimeClockCorrection({ message: correctionMessage.trim(), relatedDate: correctionDate || undefined }),
    onSuccess: () => {
      setCorrectionMessage("");
      toast({ title: t("admin.timeClock.toast_request_sent") });
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.timeClock.toast_request_error"),
        variant: "destructive",
      });
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
      <p className="py-8 text-sm text-destructive">
        {error instanceof Error ? error.message : t("admin.timeClock.load_error")}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-1 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:px-0">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("admin.timeClock.request_fix_title")}</h1>
        <p className="mt-1.5 text-base text-muted-foreground sm:text-sm">{t("admin.timeClock.request_fix_desc")}</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.timeClock.request_fix_title")}</CardTitle>
          <CardDescription>{t("admin.timeClock.request_fix_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,200px)_1fr]">
            <Input
              type="date"
              value={correctionDate}
              onChange={(e) => setCorrectionDate(e.target.value)}
              className="min-h-11 text-base md:text-sm"
            />
            <Textarea
              rows={2}
              value={correctionMessage}
              onChange={(e) => setCorrectionMessage(e.target.value)}
              placeholder={t("admin.timeClock.request_fix_placeholder")}
              className="text-base md:text-sm"
            />
          </div>
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">{t("admin.timeClock.request_fix_day_summary")}</p>
            {correctionDaySummary ? (
              <>
                <p className="text-sm">
                  {t("admin.timeClock.request_fix_day_hours").replace(
                    "{{hours}}",
                    (correctionDaySummary.workedMinutes / 60).toFixed(2)
                  )}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {correctionDayEvents.map((e) => (
                    <Badge key={e.id} variant="outline" className="text-[11px]">
                      {formatTime(e.eventAt)} · {timeClockKindLabel(e.eventKind, t)}
                    </Badge>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("admin.timeClock.request_fix_day_empty")}</p>
            )}
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              className="min-h-11 gap-1.5 touch-manipulation text-base sm:min-h-10 sm:text-sm"
              onClick={() => correctionMutation.mutate()}
              disabled={!correctionMessage.trim() || correctionMutation.isPending}
            >
              <Send className="h-4 w-4 shrink-0" aria-hidden />
              {t("admin.timeClock.request_fix_send")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkerTimeClockCorrection;
