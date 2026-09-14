import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  Building2,
  ClipboardList,
  Clock3,
  Contact2,
  Euro,
  FileText,
  FileUser,
  FolderKanban,
  Loader2,
  MessageSquare,
  Palmtree,
  TriangleAlert,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BackofficeTodayDateCard } from "@/components/admin/BackofficeTodayDateCard";
import { useMyBackofficeMessages } from "@/hooks/useBackofficeMessages";
import { useMyDmsDocumentReviewsAsAssignee } from "@/hooks/useMyDmsDocumentReviews";
import { usePendingWorkerProfileChangeRequests } from "@/hooks/useWorkerProfileChangeRequests";
import { usePendingWorkerVacationChangeRequests } from "@/hooks/useWorkerVacationChangeRequests";
import { usePendingWorkerExpenseSheets } from "@/hooks/useWorkerExpenseSheets";
import { useLanguage } from "@/contexts/LanguageContext";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import type { BackofficeSession } from "@/types/backoffice";
import { ADMIN_PATHS } from "@/constants/adminPaths";
import { cn } from "@/lib/utils";
import {
  billingInvoiceHasCollectionOutstanding,
  billingInvoiceOutstandingAmount,
} from "@/lib/billingCollectionSemaphore";
import { draftGroupYearMonth, formatInvoiceMonthHeading, issuedGroupYearMonth } from "@/lib/billingInvoiceGroups";
import { useBillingInvoices } from "@/hooks/useBilling";
import type { BillingInvoiceRecord } from "@/types/billing";
import { useClients } from "@/hooks/useClients";
import { useCompanyWorkers } from "@/hooks/useCompanyWorkers";
import { useProjects } from "@/hooks/useProjects";

type Props = {
  session: BackofficeSession;
};

function fillKpiTemplate(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (acc, [key, val]) => acc.split(`{{${key}}}`).join(String(val)),
    template
  );
}

/** Escala de grises por mes (quesito 3 meses facturación panel admin). */
const DASHBOARD_BILLING_PIE_COLORS = [
  "#171717",
  "#262626",
  "#404040",
  "#525252",
  "#737373",
  "#a3a3a3",
  "#1c1917",
  "#292524",
  "#44403c",
  "#57534e",
  "#78716c",
  "#a8a29e",
] as const;

function countProjectsOngoing(projects: { endDate: string }[]): number {
  const today = new Date().toISOString().slice(0, 10);
  return projects.filter((p) => p.endDate.slice(0, 10) >= today).length;
}

function calendarYmShift(monthsDelta: number): string {
  const d = new Date();
  const t = new Date(d.getFullYear(), d.getMonth() + monthsDelta, 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
}

/** Fecha local de hoy en formato `YYYY-MM-DD`. */
function localTodayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function billingInvoiceComparableYmd(inv: BillingInvoiceRecord): string | null {
  const raw = inv.issueDate?.trim() ?? inv.issuedAt?.trim() ?? "";
  const ymd = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

/** Agrega saldo pendiente de cobro en emitidas (misma regla que el listado / semáforo). */
function billingOutstandingCollectPending(invoices: BillingInvoiceRecord[]): { count: number; outstanding: number } {
  let count = 0;
  let outstanding = 0;
  for (const inv of invoices) {
    if (inv.status === "DRAFT") continue;
    if (!billingInvoiceHasCollectionOutstanding(inv)) continue;
    count += 1;
    outstanding += billingInvoiceOutstandingAmount(inv);
  }
  return { count, outstanding: Math.round(outstanding * 100) / 100 };
}

/** Suma `grandTotal` de emitidas (sin borrador ni anuladas) con fecha de factura/emisión ≤ `todayYmd`. Sin fecha comparable: se incluye. */
function sumIssuedGrandTotalUpToDate(invoices: BillingInvoiceRecord[], todayYmd: string): number {
  let s = 0;
  for (const inv of invoices) {
    if (inv.status === "DRAFT" || inv.status === "CANCELLED") continue;
    const ymd = billingInvoiceComparableYmd(inv);
    if (ymd != null && ymd > todayYmd) continue;
    s += Number(inv.grandTotal) || 0;
  }
  return Math.round(s * 100) / 100;
}

function countBillingDraftsYm(invoices: BillingInvoiceRecord[], ym: string): number {
  if (!/^\d{4}-\d{2}$/.test(ym)) return 0;
  const ys = Number(ym.slice(0, 4));
  const ms = Number(ym.slice(5, 7));
  return invoices.filter((inv) => {
    if (inv.status !== "DRAFT") return false;
    const { y, m } = draftGroupYearMonth(inv);
    return y === ys && m === ms;
  }).length;
}

/** Emitidas efectivas en Facturación (no borrador ni anulada). */
function isEffectiveIssued(inv: BillingInvoiceRecord): boolean {
  return inv.status !== "DRAFT" && inv.status !== "CANCELLED";
}

function aggregateEffectiveIssuedYm(invoices: BillingInvoiceRecord[], ym: string): { count: number; total: number } {
  if (!/^\d{4}-\d{2}$/.test(ym)) return { count: 0, total: 0 };
  const ys = Number(ym.slice(0, 4));
  const ms = Number(ym.slice(5, 7));
  let count = 0;
  let total = 0;
  for (const inv of invoices) {
    if (!isEffectiveIssued(inv)) continue;
    const { y, m } = issuedGroupYearMonth(inv);
    if (y !== ys || m !== ms) continue;
    count += 1;
    total += Number(inv.grandTotal) || 0;
  }
  return { count, total: Math.round(total * 100) / 100 };
}

export function AdminDashboardAdmin({ session }: Props) {
  const { t, language } = useLanguage();

  const supabaseOk = isSupabaseConfigured();
  const fetchPending = supabaseOk && !!session.userId;

  const { data: workers = [], isPending: workersOverviewPending } = useCompanyWorkers();
  const { data: clients = [], isPending: clientsOverviewPending } = useClients();
  const { data: projects = [], isPending: projectsOverviewPending } = useProjects();
  const { data: billingInvoices = [], isPending: billingOverviewPending } = useBillingInvoices(supabaseOk);

  const billingYmCurrent = calendarYmShift(0);
  const billingYmPrevious = calendarYmShift(-1);
  const billingYmMinus2 = calendarYmShift(-2);

  const billingDraftsThisMonth = useMemo(
    () => countBillingDraftsYm(billingInvoices, billingYmCurrent),
    [billingInvoices, billingYmCurrent]
  );
  const billingAggMinus2 = useMemo(
    () => aggregateEffectiveIssuedYm(billingInvoices, billingYmMinus2),
    [billingInvoices, billingYmMinus2]
  );
  const billingAggPrev = useMemo(
    () => aggregateEffectiveIssuedYm(billingInvoices, billingYmPrevious),
    [billingInvoices, billingYmPrevious]
  );
  const billingAggCurrent = useMemo(
    () => aggregateEffectiveIssuedYm(billingInvoices, billingYmCurrent),
    [billingInvoices, billingYmCurrent]
  );

  const overviewPending =
    supabaseOk && (workersOverviewPending || clientsOverviewPending || projectsOverviewPending);

  const workersTotal = workers.length;
  const workersActive = useMemo(() => workers.filter((w) => w.active).length, [workers]);
  const clientsTotal = clients.length;
  const clientsActive = useMemo(() => clients.filter((c) => c.active).length, [clients]);
  const projectsTotal = projects.length;
  const projectsOngoing = useMemo(() => countProjectsOngoing(projects), [projects]);

  const { data: pendingExpenseSheets, isPending: expensePending } =
    usePendingWorkerExpenseSheets(fetchPending);
  const { data: pendingProfileRequests, isPending: profilePending } =
    usePendingWorkerProfileChangeRequests(fetchPending);
  const { data: pendingVacationRequests, isPending: vacationPending } =
    usePendingWorkerVacationChangeRequests(fetchPending);
  const { data: backofficeMessages, isPending: messagesPending } = useMyBackofficeMessages(fetchPending);
  const { data: pendingDocReviews, isPending: docsPending } =
    useMyDmsDocumentReviewsAsAssignee(fetchPending);

  const myUserId = session.userId;

  const pendingExpenseCount = pendingExpenseSheets?.length ?? 0;
  const pendingProfileCount = pendingProfileRequests?.length ?? 0;
  const pendingVacationCount = pendingVacationRequests?.length ?? 0;
  const pendingAssignedDocsCount = pendingDocReviews?.length ?? 0;

  const { pendingTimeClockCount, unreadChatCount } = useMemo(() => {
    const msgs = backofficeMessages ?? [];
    let tc = 0;
    let chat = 0;
    for (const m of msgs) {
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

  const listsInitialLoading =
    fetchPending &&
    (expensePending || profilePending || vacationPending || messagesPending || docsPending);

  const hasPendingStrip =
    pendingProfileCount > 0 ||
    pendingVacationCount > 0 ||
    pendingExpenseCount > 0 ||
    pendingTimeClockCount > 0 ||
    unreadChatCount > 0 ||
    pendingAssignedDocsCount > 0;

  const localeTag = language === "en" ? "en-GB" : language === "ca" ? "ca-ES" : "es-ES";

  const formatEuroTotalDetailed = useMemo(
    () =>
      new Intl.NumberFormat(localeTag, {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [localeTag]
  );

  const billingTodayYmd = localTodayYmd();
  const billingTodayLong = useMemo(() => {
    const [y, m, d] = billingTodayYmd.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(localeTag, { dateStyle: "long" });
  }, [billingTodayYmd, localeTag]);

  const billingGrandTotalToDate = useMemo(
    () => sumIssuedGrandTotalUpToDate(billingInvoices, billingTodayYmd),
    [billingInvoices, billingTodayYmd]
  );

  const billingPendingCollection = useMemo(
    () => billingOutstandingCollectPending(billingInvoices),
    [billingInvoices]
  );

  /** Comparativa rápida: importe emitido por mes natural (últimos 3 meses). */
  const billingLast3MonthsChartData = useMemo(() => {
    const unk = t("admin.billing.group_month_unknown");
    const mkLabel = (ym: string) =>
      formatInvoiceMonthHeading(localeTag, Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), unk);
    return [
      {
        key: billingYmMinus2,
        label: mkLabel(billingYmMinus2),
        total: billingAggMinus2.total,
        count: billingAggMinus2.count,
      },
      {
        key: billingYmPrevious,
        label: mkLabel(billingYmPrevious),
        total: billingAggPrev.total,
        count: billingAggPrev.count,
      },
      {
        key: billingYmCurrent,
        label: mkLabel(billingYmCurrent),
        total: billingAggCurrent.total,
        count: billingAggCurrent.count,
      },
    ];
  }, [
    billingYmMinus2,
    billingYmPrevious,
    billingYmCurrent,
    billingAggMinus2,
    billingAggPrev,
    billingAggCurrent,
    localeTag,
    t,
  ]);

  const billingLast3MonthsPieData = useMemo(
    () =>
      billingLast3MonthsChartData
        .map((row, i) => ({
          name: row.label,
          value: row.total,
          count: row.count,
          fill: DASHBOARD_BILLING_PIE_COLORS[i % DASHBOARD_BILLING_PIE_COLORS.length],
        }))
        .filter((d) => d.value > 0),
    [billingLast3MonthsChartData]
  );
  const billingLast3MonthsPieHasData = billingLast3MonthsPieData.length > 0;

  const showAssignedDocsCard =
    fetchPending && !docsPending && pendingAssignedDocsCount > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold tracking-tight">{t("admin.dashboard.worker_title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("admin.dashboard.admin_role_intro")}{" "}
            <strong>{t("admin.dashboard.admin_role_strong")}</strong> {t("admin.dashboard.admin_role_intro_end")}
          </p>
        </div>
        <BackofficeTodayDateCard
          todayTitle={t("admin.dashboard.worker_today_title")}
          language={language}
          localeTag={localeTag}
        />
      </div>

      {supabaseOk ? (
        <>
          {overviewPending ? (
            <Card className="flex flex-col border-2 shadow-sm">
              <CardContent className="flex items-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                {t("admin.common.loading")}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Link
              to="/admin/trabajadores"
              className="block min-w-0 rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full border-2 shadow-sm transition-colors hover:bg-muted/40">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Contact2 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                    <CardTitle className="text-base">{t("admin.dashboard.kpi_workers")}</CardTitle>
                  </div>
                  <CardDescription>
                    {fillKpiTemplate(t("admin.dashboard.admin_kpi_workers_summary"), {
                      active: workersActive,
                      total: workersTotal,
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-4 pt-0">
                  <span className="text-4xl font-bold tabular-nums tracking-tight text-foreground">
                    {workersTotal > 999 ? "999+" : workersTotal}
                  </span>
                  <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full sm:w-auto")}>
                    {t("admin.dashboard.link_workers")}
                  </span>
                </CardContent>
              </Card>
            </Link>

            <Link
              to="/admin/clientes"
              className="block min-w-0 rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full border-2 shadow-sm transition-colors hover:bg-muted/40">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                    <CardTitle className="text-base">{t("admin.dashboard.kpi_clients")}</CardTitle>
                  </div>
                  <CardDescription>
                    {fillKpiTemplate(t("admin.dashboard.admin_kpi_clients_summary"), {
                      active: clientsActive,
                      total: clientsTotal,
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-4 pt-0">
                  <span className="text-4xl font-bold tabular-nums tracking-tight text-foreground">
                    {clientsTotal > 999 ? "999+" : clientsTotal}
                  </span>
                  <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full sm:w-auto")}>
                    {t("admin.dashboard.link_clients")}
                  </span>
                </CardContent>
              </Card>
            </Link>

            <Link
              to="/admin/proyectos"
              className="block min-w-0 rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring sm:col-span-2 xl:col-span-1"
            >
              <Card className="h-full border-2 shadow-sm transition-colors hover:bg-muted/40">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <FolderKanban className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                    <CardTitle className="text-base">{t("admin.dashboard.kpi_projects")}</CardTitle>
                  </div>
                  <CardDescription>
                    {fillKpiTemplate(t("admin.dashboard.admin_kpi_projects_summary"), {
                      ongoing: projectsOngoing,
                      total: projectsTotal,
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-4 pt-0">
                  <span className="text-4xl font-bold tabular-nums tracking-tight text-foreground">
                    {projectsTotal > 999 ? "999+" : projectsTotal}
                  </span>
                  <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full sm:w-auto")}>
                    {t("admin.dashboard.link_projects")}
                  </span>
                </CardContent>
              </Card>
            </Link>
          </div>
          )}
          {!overviewPending ? (
            billingOverviewPending ? (
              <Card className="flex flex-col border-2 shadow-sm">
                <CardContent className="flex items-center gap-2 py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                  {t("admin.common.loading")}
                </CardContent>
              </Card>
            ) : (
              <Card className="flex flex-col border-2 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                    <CardTitle className="text-base font-bold uppercase tracking-[0.18em] text-foreground">
                      {t("admin.dashboard.admin_billing_section_title")}
                    </CardTitle>
                  </div>
                  <CardDescription>{t("admin.dashboard.admin_billing_section_hint")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:items-stretch sm:gap-x-4 sm:gap-y-0">
                    <div className="min-w-0 w-full rounded-lg border border-green-200/90 bg-green-50 px-4 py-4 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/35">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-green-900/70 dark:text-emerald-300/80">
                        {t("admin.dashboard.admin_billing_current_month_label")}
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-tight text-green-950 dark:text-emerald-50">
                        {formatInvoiceMonthHeading(
                          localeTag,
                          Number(billingYmCurrent.slice(0, 4)),
                          Number(billingYmCurrent.slice(5, 7)),
                          billingYmCurrent
                        )}
                      </p>
                      <dl className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between gap-2">
                          <dt className="text-green-900/65 dark:text-emerald-200/70">{t("admin.dashboard.admin_billing_row_issued")}</dt>
                          <dd className="font-bold tabular-nums text-green-950 dark:text-emerald-50">
                            {billingAggCurrent.count > 999 ? "999+" : billingAggCurrent.count}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-green-900/65 dark:text-emerald-200/70">{t("admin.dashboard.admin_billing_row_amount")}</dt>
                          <dd className="font-semibold tabular-nums leading-tight text-green-950 dark:text-emerald-50">
                            {formatEuroTotalDetailed.format(billingAggCurrent.total)}
                          </dd>
                        </div>
                      </dl>
                      <div className="mt-3 space-y-2.5">
                        <Link
                          to={`/admin/facturacion?tab=drafts&period=${encodeURIComponent(billingYmCurrent)}`}
                          className={cn(
                            "flex flex-col gap-2 rounded-md border border-green-200/80 bg-white/70 px-3 py-2.5 outline-none ring-offset-background transition-colors hover:bg-white/95 focus-visible:ring-2 focus-visible:ring-ring dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:hover:bg-emerald-950/70"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-green-950 dark:text-emerald-50">{t("admin.dashboard.admin_billing_row_drafts")}</span>
                            <span className="text-xl font-bold tabular-nums tracking-tight text-green-950 dark:text-emerald-50">
                              {billingDraftsThisMonth > 999 ? "999+" : billingDraftsThisMonth}
                            </span>
                          </div>
                          <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 w-full border-green-300/80 bg-white/90 text-xs hover:bg-white dark:border-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50")}>
                            {t("admin.dashboard.admin_dashboard_billing_open")}
                          </span>
                        </Link>
                        <Link
                          to={`/admin/facturacion?tab=issued&period=${encodeURIComponent(billingYmCurrent)}`}
                          className={cn(
                            "flex flex-col gap-2 rounded-md border border-green-200/80 bg-white/70 px-3 py-2.5 outline-none ring-offset-background transition-colors hover:bg-white/95 focus-visible:ring-2 focus-visible:ring-ring dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:hover:bg-emerald-950/70"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-green-950 dark:text-emerald-50">{t("admin.dashboard.admin_billing_row_issued")}</span>
                            <span className="text-xl font-bold tabular-nums tracking-tight text-green-950 dark:text-emerald-50">
                              {billingAggCurrent.count > 999 ? "999+" : billingAggCurrent.count}
                            </span>
                          </div>
                          <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 w-full border-green-300/80 bg-white/90 text-xs hover:bg-white dark:border-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50")}>
                            {t("admin.dashboard.admin_dashboard_billing_open")}
                          </span>
                        </Link>
                      </div>
                    </div>

                    <div className="flex min-h-0 min-w-0 w-full flex-col gap-3 sm:h-full">
                      <div className="flex min-h-0 flex-1 flex-col justify-between gap-3 rounded-lg border border-border/80 bg-muted/25 px-4 py-4 shadow-sm">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {t("admin.dashboard.admin_billing_two_months_ago_label")}
                          </p>
                          <p className="mt-1 text-sm font-semibold leading-tight text-foreground">
                            {formatInvoiceMonthHeading(
                              localeTag,
                              Number(billingYmMinus2.slice(0, 4)),
                              Number(billingYmMinus2.slice(5, 7)),
                              billingYmMinus2
                            )}
                          </p>
                          <dl className="mt-3 space-y-2 text-sm">
                            <div className="flex justify-between gap-2">
                              <dt className="text-muted-foreground">{t("admin.dashboard.admin_billing_row_issued")}</dt>
                              <dd className="font-bold tabular-nums text-foreground">
                                {billingAggMinus2.count > 999 ? "999+" : billingAggMinus2.count}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-muted-foreground">{t("admin.dashboard.admin_billing_row_amount")}</dt>
                              <dd className="font-semibold tabular-nums text-foreground leading-tight">
                                {formatEuroTotalDetailed.format(billingAggMinus2.total)}
                              </dd>
                            </div>
                          </dl>
                        </div>
                        <Link
                          to={`/admin/facturacion?tab=issued&period=${encodeURIComponent(billingYmMinus2)}`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-auto h-9 w-full shrink-0 text-sm")}
                        >
                          {t("admin.dashboard.admin_dashboard_billing_open")}
                        </Link>
                      </div>

                      <div className="flex min-h-0 flex-1 flex-col justify-between gap-3 rounded-lg border border-border/80 bg-muted/25 px-4 py-4 shadow-sm">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {t("admin.dashboard.admin_billing_prev_month_label")}
                          </p>
                          <p className="mt-1 text-sm font-semibold leading-tight text-foreground">
                            {formatInvoiceMonthHeading(
                              localeTag,
                              Number(billingYmPrevious.slice(0, 4)),
                              Number(billingYmPrevious.slice(5, 7)),
                              billingYmPrevious
                            )}
                          </p>
                          <dl className="mt-3 space-y-2 text-sm">
                            <div className="flex justify-between gap-2">
                              <dt className="text-muted-foreground">{t("admin.dashboard.admin_billing_row_issued")}</dt>
                              <dd className="font-bold tabular-nums text-foreground">
                                {billingAggPrev.count > 999 ? "999+" : billingAggPrev.count}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-muted-foreground">{t("admin.dashboard.admin_billing_row_amount")}</dt>
                              <dd className="font-semibold tabular-nums text-foreground leading-tight">
                                {formatEuroTotalDetailed.format(billingAggPrev.total)}
                              </dd>
                            </div>
                          </dl>
                        </div>
                        <Link
                          to={`/admin/facturacion?tab=issued&period=${encodeURIComponent(billingYmPrevious)}`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-auto h-9 w-full shrink-0 text-sm")}
                        >
                          {t("admin.dashboard.admin_dashboard_billing_open")}
                        </Link>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/80 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("admin.dashboard.admin_billing_bar_chart_title")}
                    </p>
                    <div className="mt-3 h-[220px] w-full">
                      {!billingLast3MonthsPieHasData ? (
                        <p className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          {t("admin.dashboard.admin_billing_bar_chart_empty")}
                        </p>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                            <Pie
                              data={billingLast3MonthsPieData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="42%"
                              innerRadius={38}
                              outerRadius={68}
                              paddingAngle={2}
                              stroke="hsl(var(--background))"
                              strokeWidth={2}
                            >
                              {billingLast3MonthsPieData.map((entry) => (
                                <Cell key={entry.name} fill={entry.fill} />
                              ))}
                            </Pie>
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const p = payload[0].payload as {
                                  name: string;
                                  value: number;
                                  count: number;
                                };
                                return (
                                  <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
                                    <p className="font-medium text-popover-foreground">{p.name}</p>
                                    <p className="mt-0.5 tabular-nums text-popover-foreground">
                                      {formatEuroTotalDetailed.format(p.value)}
                                    </p>
                                    <p className="mt-1 text-muted-foreground">
                                      {fillKpiTemplate(t("admin.dashboard.admin_billing_bar_tooltip_invoices"), {
                                        count: p.count,
                                      })}
                                    </p>
                                  </div>
                                );
                              }}
                            />
                            <Legend
                              layout="horizontal"
                              verticalAlign="bottom"
                              wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                              formatter={(value) => (
                                <span className="text-muted-foreground">{value}</span>
                              )}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/80 px-4 py-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Link
                        to="/admin/facturacion?tab=issued&collection=all"
                        className={cn(
                          "flex min-w-0 flex-col gap-2 rounded-md border border-border/50 bg-muted/10 px-3 py-3 outline-none ring-offset-background transition-colors hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring"
                        )}
                      >
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-[10px] font-medium tracking-wide text-muted-foreground">
                            {t("admin.dashboard.admin_billing_total_to_date_title")}
                          </p>
                          <p className="text-[10px] leading-snug text-muted-foreground/90">
                            {fillKpiTemplate(t("admin.dashboard.admin_billing_total_to_date_cutoff"), {
                              date: billingTodayLong,
                            })}
                          </p>
                        </div>
                        <p className="text-base font-medium tabular-nums tracking-tight text-muted-foreground">
                          {formatEuroTotalDetailed.format(billingGrandTotalToDate)}
                        </p>
                      </Link>

                      <Link
                        to="/admin/facturacion?tab=issued&collection=outstanding"
                        className={cn(
                          "flex min-w-0 flex-col gap-2 rounded-md border border-border/50 bg-muted/10 px-3 py-3 outline-none ring-offset-background transition-colors hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring"
                        )}
                      >
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-[10px] font-medium tracking-wide text-muted-foreground">
                            {t("admin.dashboard.admin_billing_outstanding_total_title")}
                          </p>
                          <p className="text-[10px] leading-snug text-muted-foreground/90">
                            {t("admin.dashboard.admin_billing_outstanding_total_hint")}
                          </p>
                        </div>
                        <p className="text-base font-medium tabular-nums tracking-tight text-muted-foreground">
                          {formatEuroTotalDetailed.format(billingPendingCollection.outstanding)}
                        </p>
                        {billingPendingCollection.count > 0 ? (
                          <p className="text-[10px] leading-snug text-muted-foreground">
                            {billingPendingCollection.count === 1
                              ? t("admin.dashboard.admin_billing_outstanding_invoice_one")
                              : fillKpiTemplate(t("admin.dashboard.admin_billing_outstanding_invoice_many"), {
                                  count: billingPendingCollection.count,
                                })}
                          </p>
                        ) : (
                          <p className="text-[10px] leading-snug text-muted-foreground">
                            {t("admin.dashboard.admin_billing_outstanding_none")}
                          </p>
                        )}
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          ) : null}
        </>
      ) : null}

      {listsInitialLoading ? (
        <Card className="flex flex-col border-2 shadow-sm md:col-span-2 xl:col-span-3">
          <CardContent className="flex items-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
            {t("admin.common.loading")}
          </CardContent>
        </Card>
      ) : null}

      {!listsInitialLoading && hasPendingStrip ? (
        <Alert className="border-amber-500/50 bg-amber-50/90 dark:border-amber-800/50 dark:bg-amber-950/35">
          <TriangleAlert className="h-4 w-4 text-amber-800 dark:text-amber-200" aria-hidden />
          <AlertTitle>{t("admin.dashboard.admin_attention_title")}</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            {t("admin.dashboard.admin_attention_description")}
          </AlertDescription>
        </Alert>
      ) : null}

      {!listsInitialLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pendingExpenseCount > 0 ? (
            <Card className="flex flex-col border-2 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Euro className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <CardTitle className="text-base">{t("admin.layout.nav_worker_expenses_admin")}</CardTitle>
                </div>
                <CardDescription>{t("admin.dashboard.admin_card_expenses_hint")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold tabular-nums tracking-tight text-foreground">
                    {pendingExpenseCount > 99 ? "99+" : pendingExpenseCount}
                  </span>
                  <span className="text-sm text-muted-foreground">{t("admin.dashboard.admin_pending_label")}</span>
                </div>
                <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
                  <Link to={ADMIN_PATHS.gastosTrabajadores} className="inline-flex items-center gap-2">
                    <Euro className="h-4 w-4" aria-hidden />
                    {t("admin.dashboard.admin_open_expenses")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {pendingProfileCount > 0 ? (
            <Card className="flex flex-col border-2 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <FileUser className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <CardTitle className="text-base">{t("admin.layout.nav_profile_requests")}</CardTitle>
                </div>
                <CardDescription>{t("admin.dashboard.admin_card_profile_hint")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold tabular-nums tracking-tight text-foreground">
                    {pendingProfileCount > 99 ? "99+" : pendingProfileCount}
                  </span>
                  <span className="text-sm text-muted-foreground">{t("admin.dashboard.admin_pending_label")}</span>
                </div>
                <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
                  <Link to={ADMIN_PATHS.solicitudesFicha} className="inline-flex items-center gap-2">
                    <FileUser className="h-4 w-4" aria-hidden />
                    {t("admin.dashboard.admin_open_profile")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {pendingVacationCount > 0 ? (
            <Card className="flex flex-col border-2 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Palmtree className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <CardTitle className="text-base">{t("admin.layout.nav_vacation_requests")}</CardTitle>
                </div>
                <CardDescription>{t("admin.dashboard.admin_card_vacation_hint")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold tabular-nums tracking-tight text-foreground">
                    {pendingVacationCount > 99 ? "99+" : pendingVacationCount}
                  </span>
                  <span className="text-sm text-muted-foreground">{t("admin.dashboard.admin_pending_label")}</span>
                </div>
                <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
                  <Link to={ADMIN_PATHS.solicitudesVacaciones} className="inline-flex items-center gap-2">
                    <Palmtree className="h-4 w-4" aria-hidden />
                    {t("admin.dashboard.admin_open_vacation")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {pendingTimeClockCount > 0 ? (
            <Card className="flex flex-col border-2 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <CardTitle className="text-base">{t("admin.timeClock.requests_title")}</CardTitle>
                </div>
                <CardDescription>{t("admin.dashboard.admin_card_timeclock_hint")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold tabular-nums tracking-tight text-foreground">
                    {pendingTimeClockCount > 99 ? "99+" : pendingTimeClockCount}
                  </span>
                  <span className="text-sm text-muted-foreground">{t("admin.dashboard.admin_pending_label")}</span>
                </div>
                <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
                  <Link to={ADMIN_PATHS.solicitudesFichajes} className="inline-flex items-center gap-2">
                    <Clock3 className="h-4 w-4" aria-hidden />
                    {t("admin.dashboard.admin_open_timeclock")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {showAssignedDocsCard ? (
            <Card className="flex flex-col border-2 border-primary/25 shadow-sm md:col-span-2 xl:col-span-1">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <CardTitle className="text-base">{t("admin.dashboard.worker_assigned_docs_title")}</CardTitle>
                </div>
                <CardDescription>{t("admin.dashboard.worker_assigned_docs_hint")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold tabular-nums tracking-tight text-foreground">
                    {pendingAssignedDocsCount}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {t("admin.dashboard.worker_assigned_docs_count_label")}
                  </span>
                </div>
                <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
                  <Link to="/admin/documentos-pendientes" className="inline-flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" aria-hidden />
                    {t("admin.dashboard.worker_assigned_docs_link")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {unreadChatCount > 0 ? (
            <Card className="flex flex-col border-2 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <CardTitle className="text-base">{t("admin.layout.nav_worker_messages_admin")}</CardTitle>
                </div>
                <CardDescription>{t("admin.dashboard.admin_card_messages_hint")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold tabular-nums tracking-tight text-foreground">
                    {unreadChatCount > 99 ? "99+" : unreadChatCount}
                  </span>
                  <span className="text-sm text-muted-foreground">{t("admin.dashboard.worker_messages_unread_label")}</span>
                </div>
                <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
                  <Link to={ADMIN_PATHS.mensajesTrabajadores} className="inline-flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" aria-hidden />
                    {t("admin.dashboard.admin_open_messages")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {!listsInitialLoading && !hasPendingStrip ? (
        <p className="text-sm text-muted-foreground">{t("admin.dashboard.admin_all_clear")}</p>
      ) : null}
    </div>
  );
}
