import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Euro, FileUser, Palmtree, Inbox, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackofficeTodayDateCard } from "@/components/admin/BackofficeTodayDateCard";
import { useMyBackofficeMessages } from "@/hooks/useBackofficeMessages";
import { usePendingWorkerProfileChangeRequests } from "@/hooks/useWorkerProfileChangeRequests";
import { usePendingWorkerVacationChangeRequests } from "@/hooks/useWorkerVacationChangeRequests";
import { usePendingWorkerExpenseSheets } from "@/hooks/useWorkerExpenseSheets";
import { useLanguage } from "@/contexts/LanguageContext";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import type { BackofficeSession } from "@/types/backoffice";
import { ADMIN_PATHS } from "@/constants/adminPaths";

type Props = {
  session: BackofficeSession;
};

export function AdminDashboardAdmin({ session }: Props) {
  const { t, language } = useLanguage();

  const supabaseOk = isSupabaseConfigured();
  const fetchPending = supabaseOk && !!session.userId;
  const { data: pendingProfileRequests = [] } = usePendingWorkerProfileChangeRequests(fetchPending);
  const { data: pendingVacationRequests = [] } = usePendingWorkerVacationChangeRequests(fetchPending);
  const { data: pendingExpenseSheets = [] } = usePendingWorkerExpenseSheets(fetchPending);
  const { data: backofficeMessages = [] } = useMyBackofficeMessages(fetchPending);
  const myUserId = session.userId;

  const pendingProfileCount = pendingProfileRequests.length;
  const pendingVacationCount = pendingVacationRequests.length;
  const pendingExpenseCount = pendingExpenseSheets.length;

  const { pendingTimeClockCount, unreadChatCount } = useMemo(() => {
    let tc = 0;
    let chat = 0;
    for (const m of backofficeMessages) {
      if (m.recipientBackofficeUserId !== myUserId || m.readAt !== null) continue;
      if (m.category === "TIME_CLOCK_CORRECTION") {
        const st = (m.payload as { requestStatus?: string }).requestStatus ?? "PENDING";
        if (st === "PENDING") tc += 1;
        continue;
      }
      chat += 1;
    }
    return { pendingTimeClockCount: tc, unreadChatCount: chat };
  }, [backofficeMessages, myUserId]);

  const hasPendingStrip =
    pendingProfileCount > 0 ||
    pendingVacationCount > 0 ||
    pendingExpenseCount > 0 ||
    pendingTimeClockCount > 0 ||
    unreadChatCount > 0;

  const localeTag = language === "en" ? "en-GB" : language === "ca" ? "ca-ES" : "es-ES";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">{t("admin.dashboard.admin_control")}</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t("admin.dashboard.admin_hello")} {session.name}
          </h1>
        </div>
        <BackofficeTodayDateCard
          todayTitle={t("admin.dashboard.worker_today_title")}
          language={language}
          localeTag={localeTag}
        />
      </div>

      {hasPendingStrip ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {pendingExpenseCount > 0 ? (
            <Link to={ADMIN_PATHS.gastosTrabajadores} className="block min-w-0">
              <Card className="h-full border-amber-500/35 bg-amber-500/[0.06] transition-colors hover:bg-amber-500/10">
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <Euro className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
                    <span className="text-sm font-medium leading-tight">
                      {t("admin.dashboard.admin_expenses_pending_short")}
                    </span>
                  </span>
                  <Badge variant="secondary" className="shrink-0 tabular-nums">
                    {pendingExpenseCount > 99 ? "99+" : pendingExpenseCount}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ) : null}
          {pendingProfileCount > 0 ? (
            <Link to={ADMIN_PATHS.solicitudesFicha} className="block min-w-0">
              <Card className="h-full border-amber-500/35 bg-amber-500/[0.06] transition-colors hover:bg-amber-500/10">
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <FileUser className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
                    <span className="text-sm font-medium leading-tight">
                      {t("admin.layout.nav_profile_requests")}
                    </span>
                  </span>
                  <Badge variant="secondary" className="shrink-0 tabular-nums">
                    {pendingProfileCount > 99 ? "99+" : pendingProfileCount}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ) : null}
          {pendingVacationCount > 0 ? (
            <Link to={ADMIN_PATHS.solicitudesVacaciones} className="block min-w-0">
              <Card className="h-full border-amber-500/35 bg-amber-500/[0.06] transition-colors hover:bg-amber-500/10">
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <Palmtree className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
                    <span className="text-sm font-medium leading-tight">
                      {t("admin.layout.nav_vacation_requests")}
                    </span>
                  </span>
                  <Badge variant="secondary" className="shrink-0 tabular-nums">
                    {pendingVacationCount > 99 ? "99+" : pendingVacationCount}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ) : null}
          {pendingTimeClockCount > 0 ? (
            <Link to={ADMIN_PATHS.solicitudesFichajes} className="block min-w-0">
              <Card className="h-full border-amber-500/35 bg-amber-500/[0.06] transition-colors hover:bg-amber-500/10">
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <Inbox className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
                    <span className="text-sm font-medium leading-tight">
                      {t("admin.timeClock.requests_title")}
                    </span>
                  </span>
                  <Badge variant="secondary" className="shrink-0 tabular-nums">
                    {pendingTimeClockCount > 99 ? "99+" : pendingTimeClockCount}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ) : null}
          {unreadChatCount > 0 ? (
            <Link to={ADMIN_PATHS.mensajesTrabajadores} className="block min-w-0">
              <Card className="h-full border-amber-500/35 bg-amber-500/[0.06] transition-colors hover:bg-amber-500/10">
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <MessageSquare className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
                    <span className="text-sm font-medium leading-tight">
                      {t("admin.layout.nav_worker_messages_admin")}
                    </span>
                  </span>
                  <Badge variant="secondary" className="shrink-0 tabular-nums">
                    {unreadChatCount > 99 ? "99+" : unreadChatCount}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
