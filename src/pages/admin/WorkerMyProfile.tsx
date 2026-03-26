import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Loader2, Send } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompanyWorkers } from "@/hooks/useCompanyWorkers";
import {
  useHasPendingWorkerRequest,
  useWorkerProfileChangeHistory,
} from "@/hooks/useWorkerProfileChangeRequests";
import { updateMyWorkCalendarSite } from "@/api/companyWorkersApi";
import { submitWorkerProfileChangeRequest } from "@/api/workerProfileChangeRequestsApi";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/hooks/use-toast";
import type { WorkerPersonalDataSuggestion } from "@/types/workerProfileChangeRequests";
import { useWorkCalendarSites } from "@/hooks/useWorkCalendarSites";

type FormValues = {
  firstName: string;
  lastName: string;
  dni: string;
  email: string;
  mobile: string;
  postalAddress: string;
  city: string;
  workerMessage: string;
};

const WorkerMyProfile = () => {
  const { t, language } = useLanguage();
  const { user } = useAdminAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: workers = [], isLoading: loadingWorkers } = useCompanyWorkers();
  const { data: calendarSites = [] } = useWorkCalendarSites();
  const workerId = user?.companyWorkerId ?? null;
  const worker = useMemo(
    () => (workerId ? workers.find((w) => w.id === workerId) : undefined),
    [workers, workerId]
  );
  const { data: hasPending } = useHasPendingWorkerRequest(workerId);
  const { data: history = [] } = useWorkerProfileChangeHistory(workerId);

  const [calendarSiteId, setCalendarSiteId] = useState("");
  useEffect(() => {
    if (worker) setCalendarSiteId(worker.workCalendarSiteId);
  }, [worker]);

  const calendarMutation = useMutation({
    mutationFn: (siteId: string) => updateMyWorkCalendarSite(workerId!, siteId),
    onSuccess: async () => {
      toast({ title: t("admin.workerProfile.calendar_toast_saved") });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companyWorkers });
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

  const schema = useMemo(
    () =>
      z.object({
        firstName: z.string().min(1, t("admin.workerProfile.validation_required")),
        lastName: z.string().min(1, t("admin.workerProfile.validation_required")),
        dni: z.string().min(1, t("admin.workerProfile.validation_required")),
        email: z.string().email(t("admin.workerProfile.validation_email")),
        mobile: z.string(),
        postalAddress: z.string(),
        city: z.string(),
        workerMessage: z.string().max(2000),
      }),
    [t]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: worker
      ? {
          firstName: worker.firstName,
          lastName: worker.lastName,
          dni: worker.dni,
          email: worker.email,
          mobile: worker.mobile,
          postalAddress: worker.postalAddress,
          city: worker.city,
          workerMessage: "",
        }
      : undefined,
    defaultValues: {
      firstName: "",
      lastName: "",
      dni: "",
      email: "",
      mobile: "",
      postalAddress: "",
      city: "",
      workerMessage: "",
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const suggested: WorkerPersonalDataSuggestion = {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        dni: values.dni.trim(),
        email: values.email.trim().toLowerCase(),
        mobile: values.mobile.trim(),
        postalAddress: values.postalAddress.trim(),
        city: values.city.trim(),
      };
      await submitWorkerProfileChangeRequest({
        suggested,
        workerMessage: values.workerMessage.trim(),
      });
    },
    onSuccess: async () => {
      toast({ title: t("admin.workerProfile.toast_sent") });
      form.setValue("workerMessage", "");
      await queryClient.invalidateQueries({ queryKey: queryKeys.workerProfileChangeRequests });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.workerProfileChangeRequestsFor(workerId ?? ""),
      });
      await queryClient.invalidateQueries({
        queryKey: [...queryKeys.workerProfileChangeRequests, "hasPending", workerId ?? ""] as const,
      });
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    submitMutation.mutate(values);
  };

  const localeTag =
    language === "en" ? "en-GB" : language === "ca" ? "ca-ES" : "es-ES";
  const formatDt = (iso: string) =>
    new Date(iso).toLocaleString(localeTag, {
      dateStyle: "short",
      timeStyle: "short",
    });

  if (!user) return null;

  if (!workerId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("admin.workerProfile.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("admin.workerProfile.no_worker_link")}</p>
      </div>
    );
  }

  if (loadingWorkers || !worker) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        {t("admin.common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("admin.workerProfile.title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("admin.workerProfile.subtitle")}</p>
      </div>

      {hasPending && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("admin.workerProfile.pending_banner_title")}</CardTitle>
            <CardDescription>{t("admin.workerProfile.pending_banner_desc")}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
            {t("admin.workerProfile.calendar_title")}
          </CardTitle>
          <CardDescription>{t("admin.workerProfile.calendar_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-md">
            <label className="text-sm font-medium leading-none" htmlFor="worker-calendar-site">
              {t("admin.workers.field_calendar")}
            </label>
            <Select
              value={calendarSiteId}
              onValueChange={setCalendarSiteId}
              disabled={calendarMutation.isPending || calendarSites.length === 0}
            >
              <SelectTrigger id="worker-calendar-site" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {calendarSites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 max-w-md">
            <p className="text-sm font-medium">{t("admin.workerProfile.vacation_days_readonly")}</p>
            <p className="text-sm text-muted-foreground">
              {worker ? worker.vacationDays : "—"}{" "}
              <span className="text-xs">{t("admin.workerProfile.vacation_days_hint")}</span>
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            disabled={
              calendarMutation.isPending || !worker || calendarSiteId === worker.workCalendarSiteId
            }
            onClick={() => calendarMutation.mutate(calendarSiteId)}
          >
            {calendarMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {calendarMutation.isPending
              ? t("admin.workerProfile.calendar_saving")
              : t("admin.workerProfile.calendar_save")}
          </Button>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("admin.workerProfile.form_title")}</CardTitle>
              <CardDescription>{t("admin.workerProfile.form_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.workerProfile.field_first_name")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.workerProfile.field_last_name")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="dni"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.workerProfile.field_dni")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.workerProfile.field_email")}</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mobile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.workerProfile.field_mobile")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="postalAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.workerProfile.field_address")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.workerProfile.field_city")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="workerMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.workerProfile.field_message")}</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder={t("admin.workerProfile.field_message_ph")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={submitMutation.isPending || hasPending} className="gap-2">
                {submitMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {t("admin.workerProfile.submit")}
              </Button>
            </CardContent>
          </Card>
        </form>
      </Form>

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("admin.workerProfile.history_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {history.map((h) => (
              <div key={h.id} className="rounded-lg border p-3 space-y-1">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-muted-foreground">{formatDt(h.createdAt)}</span>
                  {h.status === "PENDING" && (
                    <Badge variant="secondary">{t("admin.workerProfile.status_pending")}</Badge>
                  )}
                  {h.status === "APPROVED" && (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600">
                      {t("admin.workerProfile.status_approved")}
                    </Badge>
                  )}
                  {h.status === "REJECTED" && (
                    <Badge variant="destructive">{t("admin.workerProfile.status_rejected")}</Badge>
                  )}
                </div>
                {h.status === "REJECTED" && h.rejectionReason && (
                  <p className="text-xs text-muted-foreground">
                    {t("admin.workerProfile.reject_reason")}: {h.rejectionReason}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WorkerMyProfile;
