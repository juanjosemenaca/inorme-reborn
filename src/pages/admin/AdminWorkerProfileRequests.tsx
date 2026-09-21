import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, ChevronDown, Clock3, IdCard, Layers, Loader2, Palmtree, Trash2, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DoubleConfirmAlertDialog } from "@/components/ui/double-confirm-alert-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompanyWorkers } from "@/hooks/useCompanyWorkers";
import { useAllWorkerProfileChangeRequests } from "@/hooks/useWorkerProfileChangeRequests";
import {
  approveWorkerProfileChangeRequest,
  deleteWorkerProfileChangeRequest,
  rejectWorkerProfileChangeRequest,
} from "@/api/workerProfileChangeRequestsApi";
import {
  approveWorkerCalendarChangeRequest,
  deleteWorkerCalendarChangeRequest,
  rejectWorkerCalendarChangeRequest,
} from "@/api/workerCalendarChangeRequestsApi";
import {
  approveWorkerModuleChangeRequest,
  deleteWorkerModuleChangeRequest,
  rejectWorkerModuleChangeRequest,
} from "@/api/workerModuleChangeRequestsApi";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { companyWorkerDisplayName } from "@/types/companyWorkers";
import type { WorkerProfileChangeRequestRecord } from "@/types/workerProfileChangeRequests";
import type { WorkerCalendarChangeRequestRecord } from "@/types/workerCalendarChangeRequests";
import type { WorkerModuleChangeRequestRecord } from "@/types/workerModuleChangeRequests";
import { useWorkCalendarSites } from "@/hooks/useWorkCalendarSites";
import { useAllWorkerCalendarChangeRequests } from "@/hooks/useWorkerCalendarChangeRequests";
import { useAllWorkerModuleChangeRequests } from "@/hooks/useWorkerModuleChangeRequests";
import { moduleListDiff, workerModuleLabel } from "@/lib/workerModules";
import { AdminTimeClockRequestsPanel } from "@/components/admin/AdminTimeClockRequestsPanel";
import { AdminVacationRequestsPanel } from "@/components/admin/AdminVacationRequestsPanel";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useMyBackofficeMessages } from "@/hooks/useBackofficeMessages";
import { pendingTimeClockCorrectionCount } from "@/lib/timeClockCorrectionRequests";
import {
  usePendingCarryoverRequests,
  usePendingWorkerVacationChangeRequests,
} from "@/hooks/useWorkerVacationChangeRequests";
import {
  solicitudesGroupFromHash,
  SOLICITUDES_GROUP_HASH,
  type SolicitudesGroup,
} from "@/constants/adminPaths";

type RequestGroup = SolicitudesGroup;
type AnyRequest =
  | WorkerProfileChangeRequestRecord
  | WorkerCalendarChangeRequestRecord
  | WorkerModuleChangeRequestRecord;

const AdminWorkerProfileRequests = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: workers = [] } = useCompanyWorkers();
  const { data: requests = [], isLoading, isError, error } = useAllWorkerProfileChangeRequests();
  const { data: calendarRequests = [], isLoading: loadingCalendar } = useAllWorkerCalendarChangeRequests();
  const { data: moduleRequests = [], isLoading: loadingModules } = useAllWorkerModuleChangeRequests();
  const { data: timeClockMessages = [], isLoading: loadingTimeClock } = useMyBackofficeMessages(true);
  const { data: pendingVacationRequests = [], isLoading: loadingVacations } =
    usePendingWorkerVacationChangeRequests();
  const { data: pendingCarryover = [], isLoading: loadingCarryover } = usePendingCarryoverRequests();
  const { data: calendarSites = [] } = useWorkCalendarSites();
  const [openGroup, setOpenGroup] = useState<RequestGroup | null>(() =>
    solicitudesGroupFromHash(location.hash)
  );

  useEffect(() => {
    setOpenGroup(solicitudesGroupFromHash(location.hash));
  }, [location.hash]);

  const selectGroup = (group: RequestGroup | null) => {
    const nextHash = group ? SOLICITUDES_GROUP_HASH[group] : "";
    if ((location.hash || "") === nextHash) {
      setOpenGroup(group);
      return;
    }
    navigate(
      { pathname: location.pathname, search: location.search, hash: nextHash },
      { replace: true }
    );
  };
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectKind, setRejectKind] = useState<RequestGroup>("PERSONAL");
  const [rejectTarget, setRejectTarget] = useState<AnyRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deleteProfileRequestId, setDeleteProfileRequestId] = useState<string | null>(null);
  const [deleteCalendarRequestId, setDeleteCalendarRequestId] = useState<string | null>(null);
  const [deleteModuleRequestId, setDeleteModuleRequestId] = useState<string | null>(null);

  const localeTag =
    language === "en" ? "en-GB" : language === "ca" ? "ca-ES" : "es-ES";
  const formatDt = (iso: string) =>
    new Date(iso).toLocaleString(localeTag, { dateStyle: "short", timeStyle: "short" });

  const pendingPersonal = requests.filter((r) => r.status === "PENDING").length;
  const pendingCalendar = calendarRequests.filter((r) => r.status === "PENDING").length;
  const pendingModules = moduleRequests.filter((r) => r.status === "PENDING").length;
  const pendingTimeClock = pendingTimeClockCorrectionCount(timeClockMessages, user?.userId ?? "");
  const pendingVacations = pendingVacationRequests.length + pendingCarryover.length;

  const invalidateRequestQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.workerProfileChangeRequests });
    await queryClient.invalidateQueries({ queryKey: queryKeys.workerCalendarChangeRequests });
    await queryClient.invalidateQueries({ queryKey: queryKeys.workerModuleChangeRequests });
    await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessages });
    await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessageUnreadCount });
  };

  const approveMutation = useMutation({
    mutationFn: approveWorkerProfileChangeRequest,
    onSuccess: async () => {
      toast({ title: t("admin.workerProfileRequests.toast_approved") });
      await invalidateRequestQueries();
      await queryClient.invalidateQueries({ queryKey: queryKeys.companyWorkers });
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeUsers });
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason, kind }: { id: string; reason: string; kind: RequestGroup }) => {
      if (kind === "CALENDAR") return rejectWorkerCalendarChangeRequest(id, reason);
      if (kind === "MODULES") return rejectWorkerModuleChangeRequest(id, reason);
      return rejectWorkerProfileChangeRequest(id, reason);
    },
    onSuccess: async () => {
      toast({ title: t("admin.workerProfileRequests.toast_rejected") });
      setRejectOpen(false);
      setRejectTarget(null);
      setRejectReason("");
      await invalidateRequestQueries();
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

  const approveCalendarMutation = useMutation({
    mutationFn: approveWorkerCalendarChangeRequest,
    onSuccess: async () => {
      toast({ title: t("admin.workerProfileRequests.toast_calendar_approved") });
      await invalidateRequestQueries();
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

  const approveModulesMutation = useMutation({
    mutationFn: approveWorkerModuleChangeRequest,
    onSuccess: async () => {
      toast({ title: t("admin.workerProfileRequests.toast_modules_approved") });
      await invalidateRequestQueries();
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeUsers });
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

  const deleteCalendarMutation = useMutation({
    mutationFn: deleteWorkerCalendarChangeRequest,
    onSuccess: async () => {
      toast({ title: t("admin.workerProfileRequests.toast_deleted") });
      await queryClient.invalidateQueries({ queryKey: queryKeys.workerCalendarChangeRequests });
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWorkerProfileChangeRequest,
    onSuccess: async () => {
      toast({ title: t("admin.workerProfileRequests.toast_deleted") });
      await queryClient.invalidateQueries({ queryKey: queryKeys.workerProfileChangeRequests });
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

  const deleteModulesMutation = useMutation({
    mutationFn: deleteWorkerModuleChangeRequest,
    onSuccess: async () => {
      toast({ title: t("admin.workerProfileRequests.toast_deleted") });
      await queryClient.invalidateQueries({ queryKey: queryKeys.workerModuleChangeRequests });
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

  const workerName = (companyWorkerId: string) => {
    const w = workers.find((x) => x.id === companyWorkerId);
    return w ? companyWorkerDisplayName(w) : companyWorkerId;
  };

  const openReject = (req: AnyRequest, kind: RequestGroup) => {
    setRejectKind(kind);
    setRejectTarget(req);
    setRejectReason("");
    setRejectOpen(true);
  };

  const confirmReject = () => {
    if (!rejectTarget) return;
    rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason, kind: rejectKind });
  };

  const siteName = (id: string) => calendarSites.find((s) => s.id === id)?.name ?? id;

  const groups: {
    id: RequestGroup;
    title: string;
    hint: string;
    pending: number;
    icon: typeof IdCard;
  }[] = [
    {
      id: "PERSONAL",
      title: t("admin.workerProfileRequests.pending_title"),
      hint: t("admin.workerProfileRequests.group_personal_hint"),
      pending: pendingPersonal,
      icon: IdCard,
    },
    {
      id: "CALENDAR",
      title: t("admin.workerProfileRequests.calendar_title"),
      hint: t("admin.workerProfileRequests.group_calendar_hint"),
      pending: pendingCalendar,
      icon: CalendarDays,
    },
    {
      id: "VACATIONS",
      title: t("admin.workerProfileRequests.vacations_title"),
      hint: t("admin.workerProfileRequests.group_vacations_hint"),
      pending: pendingVacations,
      icon: Palmtree,
    },
    {
      id: "MODULES",
      title: t("admin.workerProfileRequests.modules_title"),
      hint: t("admin.workerProfileRequests.group_modules_hint"),
      pending: pendingModules,
      icon: Layers,
    },
    {
      id: "TIME_CLOCK",
      title: t("admin.workerProfileRequests.timeclock_title"),
      hint: t("admin.workerProfileRequests.group_timeclock_hint"),
      pending: pendingTimeClock,
      icon: Clock3,
    },
  ];

  if (isLoading || loadingCalendar || loadingModules || loadingTimeClock || loadingVacations || loadingCarryover) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        {t("admin.common.loading")}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-destructive text-sm py-8">
        {error instanceof Error ? error.message : t("admin.workerProfileRequests.load_error")}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("admin.workerProfileRequests.title")}</h1>
        <p className="text-muted-foreground text-sm mt-1 max-w-3xl">
          {t("admin.workerProfileRequests.subtitle")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => {
          const selected = openGroup === g.id;
          const hasNew = g.pending > 0;
          const Icon = g.icon;
          return (
            <button
              key={g.id}
              type="button"
              aria-expanded={selected}
              onClick={() => selectGroup(selected ? null : g.id)}
              className={cn(
                "rounded-xl border bg-card p-4 text-left shadow-sm transition-colors",
                "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected && "ring-2 ring-primary",
                hasNew && "border-amber-500/70 bg-amber-500/5"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="flex items-center gap-1.5">
                  {hasNew ? (
                    <Badge className="bg-amber-600 hover:bg-amber-600">{g.pending}</Badge>
                  ) : null}
                  <ChevronDown
                    className={cn("h-4 w-4 text-muted-foreground transition-transform", selected && "rotate-180")}
                    aria-hidden
                  />
                </div>
              </div>
              <p className="mt-3 text-sm font-semibold leading-tight">{g.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{g.hint}</p>
              <p className="mt-2 text-xs font-medium">
                {hasNew
                  ? t("admin.workerProfileRequests.group_pending_count").replace(
                      "{{count}}",
                      String(g.pending)
                    )
                  : t("admin.workerProfileRequests.group_no_pending")}
              </p>
            </button>
          );
        })}
      </div>

      {openGroup === "PERSONAL" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("admin.workerProfileRequests.pending_title")}</CardTitle>
            <CardDescription>
              {t("admin.common.showing")} {requests.length}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {t("admin.workerProfileRequests.empty")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.workerProfileRequests.col_worker")}</TableHead>
                    <TableHead>{t("admin.workerProfileRequests.col_date")}</TableHead>
                    <TableHead>{t("admin.common.status")}</TableHead>
                    <TableHead>{t("admin.workerProfileRequests.col_message")}</TableHead>
                    <TableHead>{t("admin.workerProfileRequests.col_changes")}</TableHead>
                    <TableHead className="text-right w-[160px]">{t("admin.common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {workerName(req.companyWorkerId)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {formatDt(req.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={req.status === "PENDING" ? "default" : "outline"}>{req.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px]">
                        {req.workerMessage || "—"}
                      </TableCell>
                      <TableCell className="text-xs max-w-md">
                        <DiffSummary prev={req.previousSnapshot} next={req.suggested} t={t} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {req.status === "PENDING" ? (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                className="gap-1"
                                disabled={approveMutation.isPending}
                                onClick={() => approveMutation.mutate(req.id)}
                              >
                                <Check className="h-3.5 w-3.5" />
                                {t("admin.workerProfileRequests.approve")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-destructive"
                                disabled={rejectMutation.isPending}
                                onClick={() => openReject(req, "PERSONAL")}
                              >
                                <X className="h-3.5 w-3.5" />
                                {t("admin.workerProfileRequests.reject")}
                              </Button>
                            </>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-destructive"
                            disabled={deleteMutation.isPending}
                            onClick={() => setDeleteProfileRequestId(req.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t("admin.common.delete")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {openGroup === "CALENDAR" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("admin.workerProfileRequests.calendar_title")}</CardTitle>
            <CardDescription>
              {t("admin.common.showing")} {calendarRequests.length}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {calendarRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {t("admin.workerProfileRequests.calendar_empty")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.workerProfileRequests.col_worker")}</TableHead>
                    <TableHead>{t("admin.workerProfileRequests.col_date")}</TableHead>
                    <TableHead>{t("admin.common.status")}</TableHead>
                    <TableHead>{t("admin.workerProfileRequests.col_from")}</TableHead>
                    <TableHead>{t("admin.workerProfileRequests.col_to")}</TableHead>
                    <TableHead>{t("admin.workerProfileRequests.col_message")}</TableHead>
                    <TableHead className="text-right w-[160px]">{t("admin.common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calendarRequests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {workerName(req.companyWorkerId)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {formatDt(req.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={req.status === "PENDING" ? "default" : "outline"}>{req.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{siteName(req.previousSiteId)}</TableCell>
                      <TableCell className="text-sm">{siteName(req.suggestedSiteId)}</TableCell>
                      <TableCell className="text-sm max-w-[200px]">
                        {req.workerMessage || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {req.status === "PENDING" ? (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                className="gap-1"
                                disabled={approveCalendarMutation.isPending}
                                onClick={() => approveCalendarMutation.mutate(req.id)}
                              >
                                <Check className="h-3.5 w-3.5" />
                                {t("admin.workerProfileRequests.approve")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-destructive"
                                disabled={rejectMutation.isPending}
                                onClick={() => openReject(req, "CALENDAR")}
                              >
                                <X className="h-3.5 w-3.5" />
                                {t("admin.workerProfileRequests.reject")}
                              </Button>
                            </>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-destructive"
                            disabled={deleteCalendarMutation.isPending}
                            onClick={() => setDeleteCalendarRequestId(req.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t("admin.common.delete")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {openGroup === "VACATIONS" ? <AdminVacationRequestsPanel /> : null}

      {openGroup === "MODULES" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("admin.workerProfileRequests.modules_title")}</CardTitle>
            <CardDescription>
              {t("admin.common.showing")} {moduleRequests.length}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {moduleRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {t("admin.workerProfileRequests.modules_empty")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.workerProfileRequests.col_worker")}</TableHead>
                    <TableHead>{t("admin.workerProfileRequests.col_date")}</TableHead>
                    <TableHead>{t("admin.common.status")}</TableHead>
                    <TableHead>{t("admin.workerProfileRequests.col_changes")}</TableHead>
                    <TableHead>{t("admin.workerProfileRequests.col_message")}</TableHead>
                    <TableHead className="text-right w-[160px]">{t("admin.common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {moduleRequests.map((req) => {
                    const { added, removed } = moduleListDiff(req.previousModules, req.suggestedModules);
                    return (
                      <TableRow key={req.id}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {workerName(req.companyWorkerId)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {formatDt(req.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={req.status === "PENDING" ? "default" : "outline"}>{req.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-md">
                          <ul className="list-disc space-y-0.5 pl-4">
                            {added.map((m) => (
                              <li key={`a-${m}`}>
                                {t("admin.workerProfile.modules_add")}: {workerModuleLabel(m, t)}
                              </li>
                            ))}
                            {removed.map((m) => (
                              <li key={`r-${m}`}>
                                {t("admin.workerProfile.modules_remove")}: {workerModuleLabel(m, t)}
                              </li>
                            ))}
                            {added.length === 0 && removed.length === 0 ? <li>—</li> : null}
                          </ul>
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px]">
                          {req.workerMessage || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {req.status === "PENDING" ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="gap-1"
                                  disabled={approveModulesMutation.isPending}
                                  onClick={() => approveModulesMutation.mutate(req.id)}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  {t("admin.workerProfileRequests.approve")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 text-destructive"
                                  disabled={rejectMutation.isPending}
                                  onClick={() => openReject(req, "MODULES")}
                                >
                                  <X className="h-3.5 w-3.5" />
                                  {t("admin.workerProfileRequests.reject")}
                                </Button>
                              </>
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1 text-destructive"
                              disabled={deleteModulesMutation.isPending}
                              onClick={() => setDeleteModuleRequestId(req.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {t("admin.common.delete")}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {openGroup === "TIME_CLOCK" ? <AdminTimeClockRequestsPanel /> : null}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.workerProfileRequests.reject_title")}</DialogTitle>
            <DialogDescription>{t("admin.workerProfileRequests.reject_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">{t("admin.workerProfileRequests.reject_reason_label")}</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              {t("admin.common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              onClick={confirmReject}
            >
              {t("admin.workerProfileRequests.reject_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DoubleConfirmAlertDialog
        open={deleteProfileRequestId != null}
        onOpenChange={(open) => {
          if (!open) setDeleteProfileRequestId(null);
        }}
        onConfirm={() => {
          if (deleteProfileRequestId) deleteMutation.mutate(deleteProfileRequestId);
        }}
        title={t("admin.workerProfileRequests.delete_confirm_title")}
        description={t("admin.workerProfileRequests.delete_confirm_desc")}
        disabled={deleteMutation.isPending}
      />
      <DoubleConfirmAlertDialog
        open={deleteCalendarRequestId != null}
        onOpenChange={(open) => {
          if (!open) setDeleteCalendarRequestId(null);
        }}
        onConfirm={() => {
          if (deleteCalendarRequestId) deleteCalendarMutation.mutate(deleteCalendarRequestId);
        }}
        title={t("admin.workerProfileRequests.delete_confirm_title")}
        description={t("admin.workerProfileRequests.delete_confirm_desc")}
        disabled={deleteCalendarMutation.isPending}
      />
      <DoubleConfirmAlertDialog
        open={deleteModuleRequestId != null}
        onOpenChange={(open) => {
          if (!open) setDeleteModuleRequestId(null);
        }}
        onConfirm={() => {
          if (deleteModuleRequestId) deleteModulesMutation.mutate(deleteModuleRequestId);
        }}
        title={t("admin.workerProfileRequests.delete_confirm_title")}
        description={t("admin.workerProfileRequests.delete_confirm_desc")}
        disabled={deleteModulesMutation.isPending}
      />
    </div>
  );
};

function DiffSummary({
  prev,
  next,
  t,
}: {
  prev: WorkerProfileChangeRequestRecord["previousSnapshot"];
  next: WorkerProfileChangeRequestRecord["suggested"];
  t: (k: string) => string;
}) {
  if (!prev || !next) return <span className="text-muted-foreground">—</span>;
  const keys: (keyof WorkerProfileChangeRequestRecord["suggested"])[] = [
    "firstName",
    "lastName",
    "dni",
    "email",
    "mobile",
    "postalAddress",
    "city",
  ];
  const labels: Record<string, string> = {
    firstName: t("admin.workerProfile.field_first_name"),
    lastName: t("admin.workerProfile.field_last_name"),
    dni: t("admin.workerProfile.field_dni"),
    email: t("admin.workerProfile.field_email"),
    mobile: t("admin.workerProfile.field_mobile"),
    postalAddress: t("admin.workerProfile.field_address"),
    city: t("admin.workerProfile.field_city"),
  };
  const parts: string[] = [];
  for (const k of keys) {
    const a = String(prev[k] ?? "");
    const b = String(next[k] ?? "");
    if (a !== b) {
      parts.push(`${labels[k]}: ${a} → ${b}`);
    }
  }
  if (parts.length === 0) return <span>—</span>;
  return (
    <ul className="list-disc pl-4 space-y-0.5">
      {parts.map((p, i) => (
        <li key={i}>{p}</li>
      ))}
    </ul>
  );
}

export default AdminWorkerProfileRequests;
