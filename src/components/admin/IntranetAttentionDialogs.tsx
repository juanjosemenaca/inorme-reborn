import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompanyWorkers } from "@/hooks/useCompanyWorkers";
import { useHasPendingWorkerRequest } from "@/hooks/useWorkerProfileChangeRequests";
import { useMyUnreadBackofficeMessageCount } from "@/hooks/useBackofficeMessages";
import { useMyTimeClockEvents } from "@/hooks/useTimeTracking";
import { useWorkCalendarHolidays } from "@/hooks/useWorkCalendarHolidays";
import { isWeekendIso } from "@/lib/calendarIso";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  deriveTodayWorkerTimeClock,
  monthRange,
  todayIso,
} from "@/pages/admin/workerTimeClockShared";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type AlertKind = "CLOCK_OUT" | "CLOCK_IN" | "MESSAGES" | "PROFILE";

function normalizeRole(value: unknown): "ADMIN" | "WORKER" | null {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (raw === "ADMIN") return "ADMIN";
  if (raw === "WORKER") return "WORKER";
  return null;
}

function dismissStorageKey(kind: string, dayIso: string): string {
  return `intranet.dismiss.${kind}.${dayIso}`;
}

function isDismissedToday(kind: string, dayIso: string): boolean {
  try {
    return sessionStorage.getItem(dismissStorageKey(kind, dayIso)) === "1";
  } catch {
    return false;
  }
}

function setDismissedToday(kind: string, dayIso: string): void {
  try {
    sessionStorage.setItem(dismissStorageKey(kind, dayIso), "1");
  } catch {
    // ignore
  }
}

function isWorkingDayForWorker(
  dayIso: string,
  siteHolidayDates: Set<string>
): boolean {
  if (isWeekendIso(dayIso)) return false;
  if (siteHolidayDates.has(dayIso)) return false;
  return true;
}

/** Recordatorio de salida: desde las 17:00, o tras volver a la pestaña (≥15:00) tras >2 min en segundo plano. */
const CLOCK_OUT_MIN_HOUR = 17;
const CLOCK_OUT_RETURN_MIN_HOUR = 15;
const CLOCK_IN_MIN_HOUR = 8;
const VISIBILITY_HIDDEN_MS = 120_000;

export function IntranetAttentionDialogs() {
  const { user, ready, needsPasswordChange } = useAdminAuth();
  const { t } = useLanguage();
  const userRole = normalizeRole(user?.role);
  const enabledModules = user?.enabledModules ?? [];
  const companyWorkerId = user?.companyWorkerId ?? null;
  const supabaseOk = isSupabaseConfigured();

  const today = todayIso();
  const dMonth = new Date();
  const monthKey = `${dMonth.getFullYear()}-${String(dMonth.getMonth() + 1).padStart(2, "0")}`;
  const { from, to } = monthRange(monthKey);

  const hasTimeClock =
    (userRole === "WORKER" || userRole === "ADMIN") &&
    enabledModules.includes("TIME_CLOCK") &&
    !!companyWorkerId;

  const hasMessages =
    (userRole === "WORKER" || userRole === "ADMIN") && enabledModules.includes("MESSAGES");

  const { data: workers = [] } = useCompanyWorkers();
  const worker = useMemo(
    () => (companyWorkerId ? workers.find((w) => w.id === companyWorkerId) : undefined),
    [workers, companyWorkerId]
  );
  const siteId = worker?.workCalendarSiteId ?? null;
  const holidayYear = new Date().getFullYear();
  const { data: holidays = [], isLoading: holidaysLoading } = useWorkCalendarHolidays(holidayYear);

  const siteHolidayDates = useMemo(() => {
    const set = new Set<string>();
    if (!siteId) return set;
    for (const h of holidays) {
      if (h.siteId === siteId) set.add(h.holidayDate);
    }
    return set;
  }, [holidays, siteId]);

  const calendarReady = !siteId || !holidaysLoading;
  const workingToday = isWorkingDayForWorker(today, siteHolidayDates);

  const { data: tcEvents = [], isLoading: tcLoading } = useMyTimeClockEvents(from, to, hasTimeClock);
  const tcReady = !hasTimeClock || !tcLoading;

  const todayEvents = useMemo(
    () => tcEvents.filter((e) => e.eventAt.slice(0, 10) === today),
    [tcEvents, today]
  );
  const derived = useMemo(() => deriveTodayWorkerTimeClock(todayEvents), [todayEvents]);
  const { todayState } = derived;

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const [returnToTabBump, setReturnToTabBump] = useState(0);
  const hiddenAtRef = useRef<number | null>(null);
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
      } else {
        const started = hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (started != null && Date.now() - started >= VISIBILITY_HIDDEN_MS) {
          setReturnToTabBump((b) => b + 1);
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const hour = useMemo(() => new Date().getHours(), [tick, returnToTabBump]);

  const shouldRemindClockOut =
    hasTimeClock &&
    workingToday &&
    !todayState.absent &&
    todayState.hasClockIn &&
    !todayState.hasClockOut &&
    todayState.inWork &&
    (hour >= CLOCK_OUT_MIN_HOUR ||
      (hour >= CLOCK_OUT_RETURN_MIN_HOUR && returnToTabBump > 0));

  const shouldRemindClockIn =
    hasTimeClock &&
    workingToday &&
    !todayState.absent &&
    !todayState.hasClockIn &&
    hour >= CLOCK_IN_MIN_HOUR;

  const { data: unreadCount = 0 } = useMyUnreadBackofficeMessageCount(supabaseOk && !!user && hasMessages, {
    refetchIntervalMs: 45_000,
  });

  const unreadSeeded = useRef(false);
  const lastUnread = useRef(0);
  const [messageDelta, setMessageDelta] = useState(0);
  useEffect(() => {
    if (!hasMessages || !user) return;
    if (!unreadSeeded.current) {
      lastUnread.current = unreadCount;
      unreadSeeded.current = true;
      return;
    }
    if (unreadCount > lastUnread.current) {
      setMessageDelta(unreadCount - lastUnread.current);
    }
    lastUnread.current = unreadCount;
  }, [unreadCount, hasMessages, user]);

  const { data: workerHasPendingProfileRequest = false } = useHasPendingWorkerRequest(
    userRole === "WORKER" || userRole === "ADMIN" ? companyWorkerId : null
  );

  const alertsReady =
    ready &&
    !needsPasswordChange &&
    !!user &&
    userRole !== null &&
    supabaseOk &&
    calendarReady &&
    tcReady;

  const clockOutDue =
    alertsReady && shouldRemindClockOut && !isDismissedToday("clock_out", today);
  const clockInDue =
    alertsReady && shouldRemindClockIn && !isDismissedToday("clock_in", today);
  const profileDue =
    alertsReady &&
    workerHasPendingProfileRequest &&
    !isDismissedToday("profile", today);

  const messagesDue = alertsReady && hasMessages && messageDelta > 0;

  const [openKind, setOpenKind] = useState<AlertKind | null>(null);

  useEffect(() => {
    if (openKind === "CLOCK_OUT" && !clockOutDue) setOpenKind(null);
    else if (openKind === "CLOCK_IN" && !clockInDue) setOpenKind(null);
    else if (openKind === "MESSAGES" && !messagesDue) setOpenKind(null);
    else if (openKind === "PROFILE" && !profileDue) setOpenKind(null);
  }, [openKind, clockOutDue, clockInDue, messagesDue, profileDue]);

  useEffect(() => {
    if (openKind !== null) return;
    if (clockOutDue) {
      setOpenKind("CLOCK_OUT");
      return;
    }
    if (clockInDue) {
      setOpenKind("CLOCK_IN");
      return;
    }
    if (messagesDue) {
      setOpenKind("MESSAGES");
      return;
    }
    if (profileDue) {
      setOpenKind("PROFILE");
    }
  }, [openKind, clockOutDue, clockInDue, messagesDue, profileDue]);

  const closeAndDismiss = (kind: AlertKind, dismissKey: "clock_out" | "clock_in" | "profile" | null) => {
    if (dismissKey) setDismissedToday(dismissKey, today);
    if (kind === "MESSAGES") {
      setMessageDelta(0);
    }
    setOpenKind(null);
  };

  if (!user || needsPasswordChange) return null;

  return (
    <>
      <AlertDialog
        open={openKind === "CLOCK_OUT"}
        onOpenChange={(o) => {
          if (!o) closeAndDismiss("CLOCK_OUT", "clock_out");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.intranet_alerts.clock_out_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.intranet_alerts.clock_out_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.intranet_alerts.btn_understood")}</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Link to="/admin/fichajes/fichar">{t("admin.intranet_alerts.btn_go_clock")}</Link>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={openKind === "CLOCK_IN"}
        onOpenChange={(o) => {
          if (!o) closeAndDismiss("CLOCK_IN", "clock_in");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.intranet_alerts.clock_in_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.intranet_alerts.clock_in_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.intranet_alerts.btn_understood")}</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Link to="/admin/fichajes/fichar">{t("admin.intranet_alerts.btn_go_clock")}</Link>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={openKind === "MESSAGES"}
        onOpenChange={(o) => {
          if (!o) closeAndDismiss("MESSAGES", null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.intranet_alerts.messages_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.intranet_alerts.messages_desc").replace("{{count}}", String(messageDelta))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.intranet_alerts.btn_understood")}</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Link to="/admin/mensajes">{t("admin.intranet_alerts.btn_go_messages")}</Link>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={openKind === "PROFILE"}
        onOpenChange={(o) => {
          if (!o) closeAndDismiss("PROFILE", "profile");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.intranet_alerts.profile_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.intranet_alerts.profile_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.intranet_alerts.btn_understood")}</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Link to="/admin/mi-ficha">{t("admin.intranet_alerts.btn_go_profile")}</Link>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
