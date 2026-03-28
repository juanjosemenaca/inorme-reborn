import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Palmtree, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SortableTableHead } from "@/components/admin/SortableTableHead";
import { sortRows, toggleColumnSort, type ColumnSort } from "@/lib/adminListUtils";
import { useAdminVacationSummaries } from "@/hooks/useAdminVacationSummaries";
import { useAdminVacationNotifications } from "@/hooks/useAdminVacationNotifications";
import { updateCompanyWorker } from "@/api/companyWorkersApi";
import { useLanguage } from "@/contexts/LanguageContext";
import { queryKeys } from "@/lib/queryKeys";
import { getErrorMessage } from "@/lib/errorMessage";
import { useToast } from "@/hooks/use-toast";
import type { WorkerVacationAdminSummary } from "@/api/adminVacationsApi";

const AdminVacations = () => {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("active");
  const [sort, setSort] = useState<ColumnSort | null>({ key: "workerName", dir: "asc" });
  const [allowanceDraftByWorker, setAllowanceDraftByWorker] = useState<Record<string, string>>({});

  const {
    data: rows = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useAdminVacationSummaries(year);

  useEffect(() => {
    setAllowanceDraftByWorker({});
  }, [dataUpdatedAt]);
  const {
    data: notifications = [],
    isLoading: notifLoading,
    isError: notifError,
  } = useAdminVacationNotifications(80);

  const updateAllowanceMutation = useMutation({
    mutationFn: async ({ workerId, vacationDays }: { workerId: string; vacationDays: number }) =>
      updateCompanyWorker(workerId, { vacationDays }),
    onSuccess: async (_, vars) => {
      setAllowanceDraftByWorker((prev) => {
        const next = { ...prev };
        delete next[vars.workerId];
        return next;
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.companyWorkers }),
        queryClient.invalidateQueries({ queryKey: ["adminVacationSummaries"] }),
        queryClient.invalidateQueries({ queryKey: ["workerVacationDays", vars.workerId] }),
      ]);
      toast({ title: t("admin.vacations.toast_allowance_saved") });
    },
    onError: (err) => {
      toast({
        title: t("admin.vacations.toast_allowance_error"),
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });

  const localeTag =
    language === "en" ? "en-GB" : language === "ca" ? "ca-ES" : "es-ES";
  const formatDt = (iso: string) =>
    new Date(iso).toLocaleString(localeTag, { dateStyle: "short", timeStyle: "short" });

  const filtered = useMemo(() => {
    let list = rows;
    if (activeFilter === "active") list = list.filter((r) => r.active);
    if (activeFilter === "inactive") list = list.filter((r) => !r.active);
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => {
      const hay = [r.workerName, r.siteName].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, activeFilter]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const getters: Record<string, (r: WorkerVacationAdminSummary) => string | number | boolean> = {
      workerName: (r) => r.workerName,
      siteName: (r) => r.siteName,
      annualAllowance: (r) => r.annualAllowance,
      usedInSelectedYear: (r) => r.usedInSelectedYear,
      enjoyedInSelectedYear: (r) => r.enjoyedInSelectedYear,
      pendingInSelectedYear: (r) => r.pendingInSelectedYear,
      unusedFromPreviousYear: (r) => r.unusedFromPreviousYear,
    };
    const get = getters[sort.key];
    if (!get) return filtered;
    return sortRows(filtered, sort.dir, get);
  }, [filtered, sort]);

  const handleSort = (key: string) => {
    setSort((s) => toggleColumnSort(s, key));
  };

  const getAllowanceDraft = (row: WorkerVacationAdminSummary): string =>
    allowanceDraftByWorker[row.workerId] ?? String(row.annualAllowance);

  const saveAllowanceIfChanged = (row: WorkerVacationAdminSummary) => {
    const raw = allowanceDraftByWorker[row.workerId];
    if (raw === undefined) return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      toast({
        title: t("admin.vacations.toast_allowance_error"),
        description: t("admin.vacations.allowance_invalid"),
        variant: "destructive",
      });
      setAllowanceDraftByWorker((prev) => ({ ...prev, [row.workerId]: String(row.annualAllowance) }));
      return;
    }
    const nextValue = Math.min(365, Math.max(0, Math.floor(parsed)));
    if (nextValue === row.annualAllowance) {
      setAllowanceDraftByWorker((prev) => {
        const next = { ...prev };
        delete next[row.workerId];
        return next;
      });
      return;
    }
    if (updateAllowanceMutation.isPending) return;
    updateAllowanceMutation.mutate({ workerId: row.workerId, vacationDays: nextValue });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Palmtree className="h-7 w-7 text-primary shrink-0" aria-hidden />
            {t("admin.vacations.title")}
          </h2>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">{t("admin.vacations.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground whitespace-nowrap" htmlFor="vac-year">
              {t("admin.vacations.year_label")}
            </label>
            <Input
              id="vac-year"
              type="number"
              min={2000}
              max={2100}
              className="w-24 h-9"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || currentYear)}
            />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.vacations.notifications_title")}</CardTitle>
          <CardDescription>{t("admin.vacations.notifications_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {notifLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("admin.common.loading")}
            </div>
          ) : notifError ? (
            <p className="text-sm text-destructive">{t("admin.vacations.notifications_load_error")}</p>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t("admin.vacations.notifications_empty")}</p>
          ) : (
            <div className="rounded-md border overflow-x-auto max-h-[min(420px,50vh)] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.vacations.notif_col_date")}</TableHead>
                    <TableHead>{t("admin.vacations.notif_col_worker")}</TableHead>
                    <TableHead>{t("admin.vacations.notif_col_site")}</TableHead>
                    <TableHead className="text-right">{t("admin.vacations.notif_col_year")}</TableHead>
                    <TableHead className="text-right">{t("admin.vacations.notif_col_day_added")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifications.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                        {formatDt(n.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">{n.workerName}</TableCell>
                      <TableCell>{n.siteName}</TableCell>
                      <TableCell className="text-right tabular-nums">{n.calendarYear}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{n.vacationDateAdded}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            <button
              type="button"
              className="underline hover:text-foreground"
              onClick={() => {
                void queryClient.invalidateQueries({ queryKey: queryKeys.adminVacationNotifications });
                void queryClient.invalidateQueries({ queryKey: queryKeys.adminVacationNotificationCount(14) });
              }}
            >
              {t("admin.vacations.notifications_refresh")}
            </button>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.vacations.card_title")}</CardTitle>
          <CardDescription>{t("admin.vacations.card_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("admin.vacations.search_ph")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={activeFilter}
              onValueChange={(v) => setActiveFilter(v as typeof activeFilter)}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.vacations.filter_all")}</SelectItem>
                <SelectItem value="active">{t("admin.vacations.filter_active")}</SelectItem>
                <SelectItem value="inactive">{t("admin.vacations.filter_inactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              {t("admin.common.loading")}
            </div>
          ) : isError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm space-y-2">
              <p className="font-medium text-destructive">{t("admin.vacations.load_error")}</p>
              <p className="text-muted-foreground break-words">{getErrorMessage(error)}</p>
              <button
                type="button"
                className="text-sm underline text-primary"
                onClick={() => void refetch()}
              >
                {t("admin.vacations.retry")}
              </button>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead
                      label={t("admin.vacations.col_worker")}
                      columnKey="workerName"
                      currentSort={sort}
                      onSort={handleSort}
                      className="min-w-[140px]"
                    />
                    <SortableTableHead
                      label={t("admin.vacations.col_site")}
                      columnKey="siteName"
                      currentSort={sort}
                      onSort={handleSort}
                    />
                    <SortableTableHead
                      label={t("admin.vacations.col_allowance")}
                      columnKey="annualAllowance"
                      currentSort={sort}
                      onSort={handleSort}
                      className="text-right tabular-nums"
                    />
                    <SortableTableHead
                      label={t("admin.vacations.col_used").replace("{{year}}", String(year))}
                      columnKey="usedInSelectedYear"
                      currentSort={sort}
                      onSort={handleSort}
                      className="text-right tabular-nums"
                    />
                    <SortableTableHead
                      label={t("admin.vacations.col_pending")}
                      columnKey="pendingInSelectedYear"
                      currentSort={sort}
                      onSort={handleSort}
                      className="text-right tabular-nums"
                    />
                    <SortableTableHead
                      label={t("admin.vacations.col_enjoyed")}
                      columnKey="enjoyedInSelectedYear"
                      currentSort={sort}
                      onSort={handleSort}
                      className="text-right tabular-nums"
                    />
                    <TableHead className="min-w-[200px]">{t("admin.vacations.col_carry_note")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                        {t("admin.vacations.empty")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    sorted.map((r) => (
                      <TableRow key={r.workerId}>
                        <TableCell className="font-medium">
                          <span className="inline-flex items-center gap-2">
                            {r.workerName}
                            {!r.active ? (
                              <Badge variant="secondary" className="text-xs font-normal">
                                {t("admin.common.inactive")}
                              </Badge>
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell>{r.siteName}</TableCell>
                        <TableCell className="w-[132px]">
                          <Input
                            type="number"
                            min={0}
                            max={365}
                            step={1}
                            className="h-8 text-right tabular-nums"
                            value={getAllowanceDraft(r)}
                            disabled={updateAllowanceMutation.isPending}
                            onChange={(e) =>
                              setAllowanceDraftByWorker((prev) => ({
                                ...prev,
                                [r.workerId]: e.target.value,
                              }))
                            }
                            onBlur={() => saveAllowanceIfChanged(r)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                saveAllowanceIfChanged(r);
                              }
                            }}
                            aria-label={t("admin.vacations.allowance_edit_aria").replace(
                              "{{worker}}",
                              r.workerName
                            )}
                          />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.usedInSelectedYear}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.pendingInSelectedYear}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.enjoyedInSelectedYear}</TableCell>
                        <TableCell>
                          {r.unusedFromPreviousYear > 0 ? (
                            <span className="inline-flex flex-wrap items-center gap-2 text-sm">
                              <Badge
                                variant="outline"
                                className="border-amber-500/60 bg-amber-500/10 text-amber-950 dark:text-amber-100 font-normal"
                              >
                                {t("admin.vacations.badge_unused_prev")
                                  .replace("{{prevYear}}", String(r.previousYear))
                                  .replace("{{days}}", String(r.unusedFromPreviousYear))}
                              </Badge>
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {isFetching && !isLoading ? (
            <p className="text-xs text-muted-foreground">{t("admin.vacations.refreshing")}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminVacations;
