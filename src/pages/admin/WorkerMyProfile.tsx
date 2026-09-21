import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, Layers, Loader2, Minus, Pencil, Send } from "lucide-react";
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
import {
  useHasPendingWorkerCalendarRequest,
  useWorkerCalendarChangeHistory,
} from "@/hooks/useWorkerCalendarChangeRequests";
import {
  useHasPendingWorkerModuleRequest,
  useWorkerModuleChangeHistory,
} from "@/hooks/useWorkerModuleChangeRequests";
import { submitWorkerProfileChangeRequest } from "@/api/workerProfileChangeRequestsApi";
import { submitWorkerCalendarChangeRequest } from "@/api/workerCalendarChangeRequestsApi";
import { submitWorkerModuleChangeRequest } from "@/api/workerModuleChangeRequestsApi";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { PendingRequestNotice } from "@/components/admin/PendingRequestNotice";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/hooks/use-toast";
import type { WorkerPersonalDataSuggestion } from "@/types/workerProfileChangeRequests";
import { useWorkCalendarSites } from "@/hooks/useWorkCalendarSites";
import {
  ALL_WORKER_MODULES,
  REGISTRY_MODULE_KEYS,
  type WorkerModuleKey,
} from "@/types/backoffice";
import {
  isWorkerModuleEnabled,
  moduleListDiff,
  modulesEqual,
  normalizeModuleList,
  workerModuleLabel,
} from "@/lib/workerModules";

type ModuleItem = { key: WorkerModuleKey; label: string; enabled: boolean };

function ModuleGroup({
  title,
  items,
  onLabel,
  offLabel,
  selectable = false,
  selectedKeys,
  onToggle,
}: {
  title: string;
  items: ModuleItem[];
  onLabel: string;
  offLabel: string;
  selectable?: boolean;
  selectedKeys?: ReadonlySet<WorkerModuleKey>;
  onToggle?: (key: WorkerModuleKey, enabled: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => {
          const checked = selectable ? Boolean(selectedKeys?.has(item.key)) : item.enabled;
          return (
          <li
            key={item.key}
            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
          >
            {selectable ? (
              <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => onToggle?.(item.key, v === true)}
                />
                <span className="truncate">{item.label}</span>
              </label>
            ) : (
              <>
            <span className={item.enabled ? "text-sm" : "text-sm text-muted-foreground"}>
              {item.label}
            </span>
            {item.enabled ? (
              <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                <Check className="h-3 w-3" aria-hidden />
                {onLabel}
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <Minus className="h-3 w-3" aria-hidden />
                {offLabel}
              </Badge>
            )}
              </>
            )}
          </li>
          );
        })}
      </ul>
    </div>
  );
}

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
  const { data: hasPendingCalendar } = useHasPendingWorkerCalendarRequest(workerId);
  const { data: hasPendingModules } = useHasPendingWorkerModuleRequest(workerId);
  const { data: history = [] } = useWorkerProfileChangeHistory(workerId);
  const { data: calendarHistory = [] } = useWorkerCalendarChangeHistory(workerId);
  const { data: moduleHistory = [] } = useWorkerModuleChangeHistory(workerId);
  /** Sede realmente guardada en la ficha, no la que haya seleccionada sin guardar. */
  const assignedCalendarSite = useMemo(
    () => calendarSites.find((s) => s.id === worker?.workCalendarSiteId),
    [calendarSites, worker]
  );

  const role = user?.role ?? null;
  const userModules = user?.enabledModules ?? [];
  const toModuleItems = useMemo(
    () => (keys: readonly WorkerModuleKey[]): ModuleItem[] =>
      keys.map((key) => ({
        key,
        label: workerModuleLabel(key, t),
        enabled: isWorkerModuleEnabled(role, userModules, key),
      })),
    [role, userModules, t]
  );
  const intranetModules = useMemo(
    () => toModuleItems(ALL_WORKER_MODULES),
    [toModuleItems]
  );
  const registryModules = useMemo(
    () => toModuleItems(REGISTRY_MODULE_KEYS),
    [toModuleItems]
  );

  const [calendarSiteId, setCalendarSiteId] = useState("");
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState(false);
  const [editingModules, setEditingModules] = useState(false);
  const [calendarMessage, setCalendarMessage] = useState("");
  const [moduleMessage, setModuleMessage] = useState("");
  const [draftModules, setDraftModules] = useState<WorkerModuleKey[]>([]);
  useEffect(() => {
    if (worker) setCalendarSiteId(worker.workCalendarSiteId);
  }, [worker]);
  useEffect(() => {
    setDraftModules(normalizeModuleList(userModules));
  }, [userModules]);
  useEffect(() => {
    if (hasPending) setEditingPersonal(false);
  }, [hasPending]);
  useEffect(() => {
    if (hasPendingCalendar) setEditingCalendar(false);
  }, [hasPendingCalendar]);
  useEffect(() => {
    if (hasPendingModules) setEditingModules(false);
  }, [hasPendingModules]);

  const calendarRequestMutation = useMutation({
    mutationFn: () =>
      submitWorkerCalendarChangeRequest({
        suggestedSiteId: calendarSiteId,
        workerMessage: calendarMessage,
      }),
    onSuccess: async () => {
      toast({ title: t("admin.workerProfile.toast_sent") });
      setEditingCalendar(false);
      setCalendarMessage("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.workerCalendarChangeRequests });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.workerCalendarChangeRequestsFor(workerId ?? ""),
      });
      await queryClient.invalidateQueries({
        queryKey: [...queryKeys.workerCalendarChangeRequests, "hasPending", workerId ?? ""] as const,
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

  const moduleRequestMutation = useMutation({
    mutationFn: () =>
      submitWorkerModuleChangeRequest({
        suggestedModules: draftModules,
        workerMessage: moduleMessage,
      }),
    onSuccess: async () => {
      toast({ title: t("admin.workerProfile.toast_sent") });
      setEditingModules(false);
      setModuleMessage("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.workerModuleChangeRequests });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.workerModuleChangeRequestsFor(workerId ?? ""),
      });
      await queryClient.invalidateQueries({
        queryKey: [...queryKeys.workerModuleChangeRequests, "hasPending", workerId ?? ""] as const,
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
      setEditingPersonal(false);
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

  const cancelPersonalEdit = () => {
    setEditingPersonal(false);
    if (!worker) return;
    form.reset({
      firstName: worker.firstName,
      lastName: worker.lastName,
      dni: worker.dni,
      email: worker.email,
      mobile: worker.mobile,
      postalAddress: worker.postalAddress,
      city: worker.city,
      workerMessage: "",
    });
  };

  const cancelCalendarEdit = () => {
    setEditingCalendar(false);
    setCalendarMessage("");
    if (worker) setCalendarSiteId(worker.workCalendarSiteId);
  };

  const cancelModulesEdit = () => {
    setEditingModules(false);
    setModuleMessage("");
    setDraftModules(normalizeModuleList(userModules));
  };

  const draftModuleSet = useMemo(() => new Set(draftModules), [draftModules]);
  const toggleDraftModule = (key: WorkerModuleKey, enabled: boolean) => {
    setDraftModules((prev) => {
      const next = new Set(prev);
      if (enabled) next.add(key);
      else next.delete(key);
      return normalizeModuleList([...next]);
    });
  };

  const lockedInputClass = "read-only:cursor-default read-only:bg-muted/50";

  const combinedHistory = useMemo(
    () =>
      [
        ...history.map((h) => ({ ...h, kind: "PERSONAL" as const })),
        ...calendarHistory.map((h) => ({ ...h, kind: "CALENDAR" as const })),
        ...moduleHistory.map((h) => ({ ...h, kind: "MODULES" as const })),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [history, calendarHistory, moduleHistory]
  );

  const localeTag =
    language === "en" ? "en-GB" : language === "ca" ? "ca-ES" : "es-ES";
  const formatDt = (iso: string) =>
    new Date(iso).toLocaleString(localeTag, {
      dateStyle: "short",
      timeStyle: "short",
    });

  if (!user) return null;

  if (workerId && (loadingWorkers || !worker)) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        {t("admin.common.loading")}
      </div>
    );
  }

  const modulesCard = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-4 w-4 shrink-0" aria-hidden />
          {t("admin.workerProfile.modules_title")}
        </CardTitle>
        <CardDescription>
          {editingModules
            ? t("admin.workerProfile.modules_desc_editing")
            : t("admin.workerProfile.modules_desc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ModuleGroup
          title={t("admin.moduleActivation.bulk_section_intranet")}
          items={intranetModules}
          onLabel={t("admin.workerProfile.modules_on")}
          offLabel={t("admin.workerProfile.modules_off")}
          selectable={editingModules}
          selectedKeys={draftModuleSet}
          onToggle={toggleDraftModule}
        />
        <ModuleGroup
          title={t("admin.moduleActivation.bulk_section_masters")}
          items={registryModules}
          onLabel={t("admin.workerProfile.modules_on")}
          offLabel={t("admin.workerProfile.modules_off")}
          selectable={editingModules}
          selectedKeys={draftModuleSet}
          onToggle={toggleDraftModule}
        />
        {workerId ? (
          editingModules ? (
            <>
              <div className="space-y-2 max-w-md">
                <label className="text-sm font-medium leading-none" htmlFor="worker-modules-message">
                  {t("admin.workerProfile.field_message")}
                </label>
                <Textarea
                  id="worker-modules-message"
                  rows={3}
                  placeholder={t("admin.workerProfile.field_message_ph")}
                  value={moduleMessage}
                  onChange={(e) => setModuleMessage(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="gap-2"
                  disabled={
                    moduleRequestMutation.isPending || modulesEqual(userModules, draftModules)
                  }
                  onClick={() => moduleRequestMutation.mutate()}
                >
                  {moduleRequestMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {t("admin.workerProfile.submit")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={moduleRequestMutation.isPending}
                  onClick={cancelModulesEdit}
                >
                  {t("admin.workerProfile.cancel_edit")}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Button
                type="button"
                variant="secondary"
                className="gap-2"
                disabled={Boolean(hasPendingModules)}
                onClick={() => {
                  setDraftModules(normalizeModuleList(userModules));
                  setEditingModules(true);
                }}
              >
                <Pencil className="h-4 w-4" />
                {t("admin.workerProfile.request_edit")}
              </Button>
              {hasPendingModules ? <PendingRequestNotice /> : null}
            </div>
          )
        ) : null}
      </CardContent>
    </Card>
  );

  if (!workerId || !worker) {
    return (
      <div className="space-y-8 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("admin.workerProfile.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("admin.workerProfile.no_worker_link")}</p>
        </div>
        {modulesCard}
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("admin.workerProfile.title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("admin.workerProfile.subtitle")}</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("admin.workerProfile.form_title")}</CardTitle>
              <CardDescription>
                {editingPersonal
                  ? t("admin.workerProfile.form_desc_editing")
                  : t("admin.workerProfile.form_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/40 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("admin.workerProfile.employment_label")}
                </p>
                <p className="mt-1 text-sm font-medium">
                  {t(`admin.workers.emp.${worker.employmentType}`)}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.workerProfile.field_first_name")}</FormLabel>
                      <FormControl>
                        <Input {...field} readOnly={!editingPersonal} className={lockedInputClass} />
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
                        <Input {...field} readOnly={!editingPersonal} className={lockedInputClass} />
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
                      <Input {...field} readOnly={!editingPersonal} className={lockedInputClass} />
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
                        <Input type="email" {...field} readOnly={!editingPersonal} className={lockedInputClass} />
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
                      <Input {...field} readOnly={!editingPersonal} className={lockedInputClass} />
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
                      <Input {...field} readOnly={!editingPersonal} className={lockedInputClass} />
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
                      <Input {...field} readOnly={!editingPersonal} className={lockedInputClass} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {editingPersonal ? (
                <>
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
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={submitMutation.isPending} className="gap-2">
                      {submitMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      {t("admin.workerProfile.submit")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={submitMutation.isPending}
                      onClick={cancelPersonalEdit}
                    >
                      {t("admin.workerProfile.cancel_edit")}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="gap-2"
                    disabled={Boolean(hasPending)}
                    onClick={() => setEditingPersonal(true)}
                  >
                    <Pencil className="h-4 w-4" />
                    {t("admin.workerProfile.request_edit")}
                  </Button>
                  {hasPending ? <PendingRequestNotice /> : null}
                </div>
              )}
            </CardContent>
          </Card>
        </form>
      </Form>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
            {t("admin.workerProfile.calendar_title")}
          </CardTitle>
          <CardDescription>
            {editingCalendar
              ? t("admin.workerProfile.calendar_desc_editing")
              : t("admin.workerProfile.calendar_desc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/40 px-4 py-3 max-w-md">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("admin.workerProfile.calendar_assigned_label")}
            </p>
            <p className="mt-1 text-base font-semibold">
              {assignedCalendarSite?.name ?? t("admin.workerProfile.calendar_assigned_none")}
            </p>
          </div>
          <div className="space-y-1 max-w-md">
            <p className="text-sm font-medium">{t("admin.workerProfile.vacation_days_readonly")}</p>
            <p className="text-sm text-muted-foreground">
              {worker.vacationDays}{" "}
              <span className="text-xs">{t("admin.workerProfile.vacation_days_hint")}</span>
            </p>
          </div>
          {editingCalendar ? (
            <>
              <div className="space-y-2 max-w-md">
                <label className="text-sm font-medium leading-none" htmlFor="worker-calendar-site">
                  {t("admin.workerProfile.calendar_change_label")}
                </label>
                <SearchableSelect
                  id="worker-calendar-site"
                  value={calendarSiteId}
                  onValueChange={setCalendarSiteId}
                  options={calendarSites.map((s) => ({
                    value: s.id,
                    label:
                      s.id === worker.workCalendarSiteId
                        ? `${s.name} (${t("admin.workerProfile.calendar_current_tag")})`
                        : s.name,
                  }))}
                  disabled={calendarRequestMutation.isPending || calendarSites.length === 0}
                  className="w-full"
                />
              </div>
              <div className="space-y-2 max-w-md">
                <label className="text-sm font-medium leading-none" htmlFor="worker-calendar-message">
                  {t("admin.workerProfile.field_message")}
                </label>
                <Textarea
                  id="worker-calendar-message"
                  rows={3}
                  placeholder={t("admin.workerProfile.field_message_ph")}
                  value={calendarMessage}
                  onChange={(e) => setCalendarMessage(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="gap-2"
                  disabled={
                    calendarRequestMutation.isPending ||
                    calendarSiteId === worker.workCalendarSiteId
                  }
                  onClick={() => calendarRequestMutation.mutate()}
                >
                  {calendarRequestMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {t("admin.workerProfile.submit")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={calendarRequestMutation.isPending}
                  onClick={cancelCalendarEdit}
                >
                  {t("admin.workerProfile.cancel_edit")}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Button
                type="button"
                variant="secondary"
                className="gap-2"
                disabled={Boolean(hasPendingCalendar)}
                onClick={() => {
                  setCalendarSiteId(worker.workCalendarSiteId);
                  setEditingCalendar(true);
                }}
              >
                <Pencil className="h-4 w-4" />
                {t("admin.workerProfile.request_edit")}
              </Button>
              {hasPendingCalendar ? <PendingRequestNotice /> : null}
            </div>
          )}
        </CardContent>
      </Card>

      {modulesCard}

      {combinedHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("admin.workerProfile.history_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {combinedHistory.map((h) => (
              <div key={`${h.kind}-${h.id}`} className="rounded-lg border p-3 space-y-1">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-muted-foreground">{formatDt(h.createdAt)}</span>
                  <Badge variant="outline">
                    {h.kind === "CALENDAR"
                      ? t("admin.workerProfile.history_kind_calendar")
                      : h.kind === "MODULES"
                        ? t("admin.workerProfile.history_kind_modules")
                        : t("admin.workerProfile.history_kind_personal")}
                  </Badge>
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
                {h.kind === "CALENDAR" && (
                  <p className="text-xs text-muted-foreground">
                    {calendarSites.find((s) => s.id === h.previousSiteId)?.name ?? h.previousSiteId}
                    {" → "}
                    {calendarSites.find((s) => s.id === h.suggestedSiteId)?.name ?? h.suggestedSiteId}
                  </p>
                )}
                {h.kind === "MODULES" && (
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      const { added, removed } = moduleListDiff(h.previousModules, h.suggestedModules);
                      const bits: string[] = [];
                      if (added.length) {
                        bits.push(
                          `${t("admin.workerProfile.modules_add")}: ${added.map((m) => workerModuleLabel(m, t)).join(", ")}`
                        );
                      }
                      if (removed.length) {
                        bits.push(
                          `${t("admin.workerProfile.modules_remove")}: ${removed.map((m) => workerModuleLabel(m, t)).join(", ")}`
                        );
                      }
                      return bits.join(" · ") || "—";
                    })()}
                  </p>
                )}
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
