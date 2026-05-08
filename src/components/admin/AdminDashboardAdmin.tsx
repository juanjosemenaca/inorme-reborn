import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
import {
  draftGroupYearMonth,
  formatInvoiceMonthHeading,
  formatInvoiceMonthOnly,
  issuedGroupYearMonth,
} from "@/lib/billingInvoiceGroups";
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

function countBillingIssuedYm(invoices: BillingInvoiceRecord[], ym: string): number {
  if (!/^\d{4}-\d{2}$/.test(ym)) return 0;
  const ys = Number(ym.slice(0, 4));
  const ms = Number(ym.slice(5, 7));
  return invoices.filter((inv) => {
    if (inv.status === "DRAFT") return false;
    const { y, m } = issuedGroupYearMonth(inv);
    return y === ys && m === ms;
  }).length;
}

function rolling12MonthsSlotsFromYm(endYm: string): { y: number; m: number }[] {
  if (!/^\d{4}-\d{2}$/.test(endYm)) return [];
  const endY = Number(endYm.slice(0, 4));
  const endM = Number(endYm.slice(5, 7));
  const rows: { y: number; m: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const t = new Date(endY, endM - 1 - i, 1);
    rows.push({ y: t.getFullYear(), m: t.getMonth() + 1 });
  }
  return rows;
}

/** Total factura (`grandTotal`) por mes en los últimos 12 meses naturales hasta `endYm` (solo emitidas; sin borrador ni anuladas). */
function issuedGrandTotalsLast12MonthsSeries(
  invoices: BillingInvoiceRecord[],
  endYm: string,
  localeTag: string,
  unknownMonthLabel: string
): { labelShort: string; total: number }[] {
  const slots = rolling12MonthsSlotsFromYm(endYm);
  const ymKey = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
  const sums = new Map<string, number>();
  for (const { y, m } of slots) sums.set(ymKey(y, m), 0);
  for (const inv of invoices) {
    if (inv.status === "DRAFT" || inv.status === "CANCELLED") continue;
    const { y, m } = issuedGroupYearMonth(inv);
    const key = ymKey(y, m);
    if (!sums.has(key)) continue;
    sums.set(key, (sums.get(key) ?? 0) + (Number(inv.grandTotal) || 0));
  }
  const multiYear = new Set(slots.map((s) => s.y)).size > 1;
  return slots.map(({ y, m }) => ({
    labelShort: multiYear
      ? formatInvoiceMonthHeading(localeTag, y, m, unknownMonthLabel)
      : formatInvoiceMonthOnly(localeTag, m, unknownMonthLabel),
    total: Math.round((sums.get(ymKey(y, m)) ?? 0) * 100) / 100,
  }));
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

  const billingDraftsThisMonth = useMemo(
    () => countBillingDraftsYm(billingInvoices, billingYmCurrent),
    [billingInvoices, billingYmCurrent]
  );
  const billingIssuedThisMonth = useMemo(
    () => countBillingIssuedYm(billingInvoices, billingYmCurrent),
    [billingInvoices, billingYmCurrent]
  );
  const billingIssuedPrevMonth = useMemo(
    () => countBillingIssuedYm(billingInvoices, billingYmPrevious),
    [billingInvoices, billingYmPrevious]
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

  const formatEuroChart = useMemo(
    () =>
      new Intl.NumberFormat(localeTag, {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
      }),
    [localeTag]
  );
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

  const billingMonthlyChartRows = useMemo(
    () =>
      issuedGrandTotalsLast12MonthsSeries(
        billingInvoices,
        billingYmCurrent,
        localeTag,
        t("admin.billing.group_month_unknown")
      ),
    [billingInvoices, billingYmCurrent, localeTag, t]
  );
  const billingMonthlyChartHasData = useMemo(
    () => billingMonthlyChartRows.some((r) => r.total > 0),
    [billingMonthlyChartRows]
  );

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
                  <div className="rounded-lg border border-border/80 bg-muted/25 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("admin.dashboard.admin_billing_prev_month_label")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatInvoiceMonthHeading(
                        localeTag,
                        Number(billingYmPrevious.slice(0, 4)),
                        Number(billingYmPrevious.slice(5, 7)),
                        billingYmPrevious
                      )}
                    </p>
                    <Link
                      to={`/admin/facturacion?tab=issued&period=${encodeURIComponent(billingYmPrevious)}`}
                      className={cn(
                        "mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background px-3 py-3 outline-none ring-offset-background transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                      )}
                    >
                      <span className="text-sm font-medium">{t("admin.dashboard.admin_billing_row_issued")}</span>
                      <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
                        {billingIssuedPrevMonth > 999 ? "999+" : billingIssuedPrevMonth}
                      </span>
                      <span
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full sm:w-auto sm:shrink-0")}
                      >
                        {t("admin.dashboard.admin_dashboard_billing_open")}
                      </span>
                    </Link>
                  </div>

                  <div className="rounded-lg border border-border/80 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("admin.dashboard.admin_billing_current_month_label")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatInvoiceMonthHeading(
                        localeTag,
                        Number(billingYmCurrent.slice(0, 4)),
                        Number(billingYmCurrent.slice(5, 7)),
                        billingYmCurrent
                      )}
                    </p>
                    <div className="mt-3 space-y-3">
                      <Link
                        to={`/admin/facturacion?tab=drafts&period=${encodeURIComponent(billingYmCurrent)}`}
                        className={cn(
                          "flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/15 px-3 py-3 outline-none ring-offset-background transition-colors hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring"
                        )}
                      >
                        <span className="text-sm font-medium">{t("admin.dashboard.admin_billing_row_drafts")}</span>
                        <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
                          {billingDraftsThisMonth > 999 ? "999+" : billingDraftsThisMonth}
                        </span>
                        <span
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full sm:w-auto sm:shrink-0")}
                        >
                          {t("admin.dashboard.admin_dashboard_billing_open")}
                        </span>
                      </Link>
                      <Link
                        to={`/admin/facturacion?tab=issued&period=${encodeURIComponent(billingYmCurrent)}`}
                        className={cn(
                          "flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/15 px-3 py-3 outline-none ring-offset-background transition-colors hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring"
                        )}
                      >
                        <span className="text-sm font-medium">{t("admin.dashboard.admin_billing_row_issued")}</span>
                        <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
                          {billingIssuedThisMonth > 999 ? "999+" : billingIssuedThisMonth}
                        </span>
                        <span
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full sm:w-auto sm:shrink-0")}
                        >
                          {t("admin.dashboard.admin_dashboard_billing_open")}
                        </span>
                      </Link>
                    </div>
                  </div>

                  <div className="border-t pt-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("admin.dashboard.admin_billing_monthly_chart_title")}
                    </p>
                    <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
                      <div className="min-w-0 w-full shrink-0 lg:max-w-[min(100%,340px)] lg:basis-[340px] space-y-2">
                        {!billingMonthlyChartHasData ? (
                          <p className="text-xs text-muted-foreground">
                            {t("admin.dashboard.admin_billing_monthly_chart_empty")}
                          </p>
                        ) : (
                          <div className="h-[148px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={billingMonthlyChartRows}
                                margin={{ top: 4, right: 2, left: 4, bottom: 20 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis
                                  dataKey="labelShort"
                                  tick={{ fontSize: 9 }}
                                  interval={0}
                                  angle={-32}
                                  textAnchor="end"
                                  height={44}
                                  stroke="hsl(var(--muted-foreground))"
                                />
                                <YAxis
                                  tickFormatter={(v) => formatEuroChart.format(v)}
                                  tick={{ fontSize: 9 }}
                                  width={44}
                                  stroke="hsl(var(--muted-foreground))"
                                />
                                <Tooltip
                                  formatter={(value: number | undefined) =>
                                    value != null ? formatEuroTotalDetailed.format(value) : ""
                                  }
                                  labelFormatter={(label) => String(label)}
                                  contentStyle={{
                                    fontSize: 12,
                                    borderRadius: 8,
                                    border: "1px solid hsl(var(--border))",
                                    background: "hsl(var(--popover))",
                                    color: "hsl(var(--popover-foreground))",
                                  }}
                                />
                                <Bar
                                  dataKey="total"
                                  name={t("admin.dashboard.admin_billing_monthly_chart_series")}
                                  fill="#6366f1"
                                  radius={[3, 3, 0, 0]}
                                  maxBarSize={28}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-stretch">
                        <Link
                          to="/admin/facturacion?tab=issued&collection=all"
                          className={cn(
                            "flex min-w-0 flex-1 flex-col gap-2 rounded-md border border-border/50 bg-muted/10 px-3 py-3 outline-none ring-offset-background transition-colors hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring"
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
                            "flex min-w-0 flex-1 flex-col gap-2 rounded-md border border-border/50 bg-muted/10 px-3 py-3 outline-none ring-offset-background transition-colors hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring"
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
                    <Link
                      to="/admin/facturacion?tab=issued&collection=all"
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "sm" }),
                        "mt-3 h-8 w-fit px-2 text-xs text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {t("admin.dashboard.admin_dashboard_billing_open")}
                    </Link>
                    <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                      {t("admin.dashboard.admin_billing_monthly_chart_footnote")}
                    </p>
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
