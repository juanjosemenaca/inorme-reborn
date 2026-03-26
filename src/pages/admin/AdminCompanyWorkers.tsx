import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Contact2, Plus, Pencil, Trash2, Search, Loader2, Filter } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useCompanyWorkers } from "@/hooks/useCompanyWorkers";
import { useProviders } from "@/hooks/useProviders";
import { useWorkCalendarSites } from "@/hooks/useWorkCalendarSites";
import {
  createCompanyWorker,
  updateCompanyWorker,
  deleteCompanyWorker,
} from "@/api/companyWorkersApi";
import { hasUsersLinkedToCompanyWorker } from "@/api/backofficeUsersApi";
import { queryKeys } from "@/lib/queryKeys";
import type { CompanyWorkerEmploymentType, CompanyWorkerRecord } from "@/types/companyWorkers";
import {
  COMPANY_WORKER_EMPLOYMENT_LABELS,
  AUTONOMO_VIA_LABELS,
  companyWorkerDisplayName,
} from "@/types/companyWorkers";
import { WorkerFormDialog, type WorkerFormValues } from "@/components/admin/WorkerFormDialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

const AdminCompanyWorkers = () => {
  const queryClient = useQueryClient();
  const { data: workers = [], isLoading, isError, error } = useCompanyWorkers();
  const { data: providers = [] } = useProviders();
  const { data: calendarSites = [] } = useWorkCalendarSites();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [employmentFilter, setEmploymentFilter] = useState<"all" | CompanyWorkerEmploymentType>("all");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [sort, setSort] = useState<ColumnSort | null>({ key: "personName", dir: "asc" });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<CompanyWorkerRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompanyWorkerRecord | null>(null);

  const providerOptions = useMemo(
    () =>
      providers
        .filter((p) => p.active)
        .map((p) => ({
          id: p.id,
          label: `${p.tradeName} — ${p.companyName}`,
        })),
    [providers]
  );

  const siteNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of calendarSites) m.set(s.id, s.name);
    return m;
  }, [calendarSites]);

  const filtered = useMemo(() => {
    let list = workers;
    if (employmentFilter !== "all") list = list.filter((w) => w.employmentType === employmentFilter);
    if (activeFilter === "active") list = list.filter((w) => w.active);
    if (activeFilter === "inactive") list = list.filter((w) => !w.active);
    if (providerFilter === "__none__") list = list.filter((w) => !w.providerId);
    else if (providerFilter !== "all") list = list.filter((w) => w.providerId === providerFilter);

    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((w) => {
      const provLabel =
        w.providerId && providers.find((p) => p.id === w.providerId)?.tradeName;
      const hay = [
        w.firstName,
        w.lastName,
        w.dni,
        w.email,
        w.city,
        provLabel ?? "",
        siteNameById.get(w.workCalendarSiteId) ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [workers, query, providers, employmentFilter, activeFilter, providerFilter, siteNameById]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const provName = (w: CompanyWorkerRecord) => {
      if (!w.providerId) return "";
      return providers.find((p) => p.id === w.providerId)?.tradeName ?? "";
    };
    const getters: Record<string, (w: CompanyWorkerRecord) => string | boolean> = {
      personName: (w) => companyWorkerDisplayName(w),
      dni: (w) => w.dni,
      email: (w) => w.email,
      city: (w) => w.city,
      employmentType: (w) => t(`admin.workers.emp.${w.employmentType}`),
      provider: (w) => provName(w),
      calendar: (w) => siteNameById.get(w.workCalendarSiteId) ?? "",
      active: (w) => w.active,
    };
    const get = getters[sort.key];
    if (!get) return filtered;
    return sortRows(filtered, sort.dir, get);
  }, [filtered, sort, providers, t, siteNameById]);

  const handleSort = (key: string) => {
    setSort((s) => toggleColumnSort(s, key));
  };

  const openCreate = () => {
    setDialogMode("create");
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (w: CompanyWorkerRecord) => {
    setDialogMode("edit");
    setEditing(w);
    setDialogOpen(true);
  };

  const handleFormSubmit = async (values: WorkerFormValues) => {
    try {
      const payload = {
        firstName: values.firstName,
        lastName: values.lastName,
        dni: values.dni,
        email: values.email,
        mobile: values.mobile,
        postalAddress: values.postalAddress,
        city: values.city,
        employmentType: values.employmentType,
        providerId: values.providerId?.trim() || null,
        autonomoVia: values.employmentType === "AUTONOMO" ? values.autonomoVia ?? null : null,
        workCalendarSiteId: values.workCalendarSiteId,
        vacationDays: values.vacationDays,
        active: values.active,
      };

      if (dialogMode === "create") {
        await createCompanyWorker(payload);
        toast({ title: t("admin.workers.toast_created") });
      } else if (editing) {
        await updateCompanyWorker(editing.id, payload);
        toast({ title: t("admin.workers.toast_updated") });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.companyWorkers });
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeUsers });
      await queryClient.invalidateQueries({ queryKey: ["adminVacationSummaries"] });
      setDialogOpen(false);
    } catch (e) {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.workers.toast_save_error"),
        variant: "destructive",
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (await hasUsersLinkedToCompanyWorker(deleteTarget.id)) {
      toast({
        title: t("admin.workers.delete_blocked_title"),
        description: t("admin.workers.delete_blocked"),
        variant: "destructive",
      });
      setDeleteTarget(null);
      return;
    }
    try {
      await deleteCompanyWorker(deleteTarget.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.companyWorkers });
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeUsers });
      toast({ title: t("admin.workers.toast_deleted") });
      setDeleteTarget(null);
    } catch (e) {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.workers.toast_delete_error"),
        variant: "destructive",
      });
    }
  };

  const providerLabel = (w: CompanyWorkerRecord) => {
    if (!w.providerId) return "—";
    const p = providers.find((x) => x.id === w.providerId);
    return p ? p.tradeName : "—";
  };

  const employmentExtra = (w: CompanyWorkerRecord) => {
    if (w.employmentType === "AUTONOMO" && w.autonomoVia) {
      return AUTONOMO_VIA_LABELS[w.autonomoVia];
    }
    return null;
  };

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
      <p className="text-destructive text-sm py-8">
        {error instanceof Error ? error.message : t("admin.workers.load_error")}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Contact2 className="h-7 w-7 text-primary" />
            {t("admin.workers.title")}
          </h2>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
            {t("admin.workers.subtitle")}{" "}
            <strong>{t("admin.workers.subtitle_strong")}</strong> {t("admin.workers.subtitle_end")}
          </p>
        </div>
        <Button className="gap-2 shrink-0" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t("admin.workers.new")}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">{t("admin.workers.list")}</CardTitle>
              <CardDescription>
                {t("admin.common.showing")} {sorted.length} {t("admin.common.of")} {workers.length}
              </CardDescription>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("admin.workers.search_ph")}
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-end pt-2 border-t border-border/60">
            <div className="flex items-center gap-2 text-muted-foreground text-xs shrink-0">
              <Filter className="h-3.5 w-3.5" />
              {t("admin.common.filters")}
            </div>
            <div className="space-y-1 min-w-[150px]">
              <label className="text-xs text-muted-foreground">{t("admin.workers.filter_contract")}</label>
              <Select
                value={employmentFilter}
                onValueChange={(v) => setEmploymentFilter(v as "all" | CompanyWorkerEmploymentType)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.common.filter_all")}</SelectItem>
                  {(Object.keys(COMPANY_WORKER_EMPLOYMENT_LABELS) as CompanyWorkerEmploymentType[]).map(
                    (k) => (
                      <SelectItem key={k} value={k}>
                        {t(`admin.workers.emp.${k}`)}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 min-w-[140px]">
              <label className="text-xs text-muted-foreground">{t("admin.common.status")}</label>
              <Select value={activeFilter} onValueChange={(v) => setActiveFilter(v as typeof activeFilter)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.common.filter_all")}</SelectItem>
                  <SelectItem value="active">{t("admin.common.filter_active")}</SelectItem>
                  <SelectItem value="inactive">{t("admin.common.filter_inactive")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 min-w-[200px] max-w-[260px]">
              <label className="text-xs text-muted-foreground">{t("admin.workers.filter_provider")}</label>
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t("admin.common.filter_all")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.common.filter_all")}</SelectItem>
                  <SelectItem value="__none__">{t("admin.workers.filter_provider_none")}</SelectItem>
                  {providers
                    .filter((p) => p.active)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.tradeName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <div className="px-6 pb-6 overflow-x-auto">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {query.trim() ||
              employmentFilter !== "all" ||
              activeFilter !== "all" ||
              providerFilter !== "all"
                ? t("admin.workers.empty_filter")
                : t("admin.workers.empty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    label={t("admin.workers.col_person")}
                    columnKey="personName"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={t("admin.workers.col_dni")}
                    columnKey="dni"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={t("admin.workers.col_email")}
                    columnKey="email"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={t("admin.workers.col_type")}
                    columnKey="employmentType"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={t("admin.workers.col_provider")}
                    columnKey="provider"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={t("admin.workers.col_calendar")}
                    columnKey="calendar"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={t("admin.workers.col_status")}
                    columnKey="active"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <TableHead className="text-right w-[100px]">{t("admin.common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">
                      <div>{companyWorkerDisplayName(w)}</div>
                      <div className="text-xs text-muted-foreground">{w.city}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{w.dni}</TableCell>
                    <TableCell>
                      <div className="text-sm">{w.email}</div>
                      <div className="text-xs text-muted-foreground">{w.mobile}</div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <Badge variant="secondary" className="font-normal">
                          {t(`admin.workers.emp.${w.employmentType}`)}
                        </Badge>
                      </div>
                      {employmentExtra(w) && (
                        <p className="text-xs text-muted-foreground mt-1 max-w-[180px]">
                          {employmentExtra(w)}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm max-w-[160px] truncate">
                      {providerLabel(w)}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {siteNameById.get(w.workCalendarSiteId) ?? "—"}
                    </TableCell>
                    <TableCell>
                      {w.active ? (
                        <Badge className="bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-600/20 border-0">
                          {t("admin.common.active")}
                        </Badge>
                      ) : (
                        <Badge variant="outline">{t("admin.common.inactive")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(w)}
                        aria-label={t("admin.common.edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteTarget(w)}
                        aria-label={t("admin.common.delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      <WorkerFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        initial={editing}
        providerOptions={providerOptions}
        calendarSites={calendarSites}
        onSubmit={handleFormSubmit}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.workers.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.workers.delete_desc")}{" "}
              <strong>{deleteTarget ? companyWorkerDisplayName(deleteTarget) : ""}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("admin.common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminCompanyWorkers;
