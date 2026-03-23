import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Truck, Plus, Pencil, Trash2, Users, Search, Loader2, Filter } from "lucide-react";
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
import { useProviders } from "@/hooks/useProviders";
import {
  createProvider,
  updateProvider,
  deleteProvider,
} from "@/api/providersApi";
import { clearProviderLinksFromWorkers } from "@/api/companyWorkersApi";
import { queryKeys } from "@/lib/queryKeys";
import type { ProviderRecord } from "@/types/providers";
import { ProviderFormDialog, type ProviderFormValues } from "@/components/admin/ProviderFormDialog";
import { ProviderContactsDialog } from "@/components/admin/ProviderContactsDialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

const AdminProviders = () => {
  const queryClient = useQueryClient();
  const { data: providers = [], isLoading, isError, error } = useProviders();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [sort, setSort] = useState<ColumnSort | null>({ key: "tradeName", dir: "asc" });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<ProviderRecord | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ProviderRecord | null>(null);

  const [contactsId, setContactsId] = useState<string | null>(null);
  const contactsProvider = useMemo(
    () => providers.find((p) => p.id === contactsId) ?? null,
    [providers, contactsId]
  );

  useEffect(() => {
    if (contactsId && !contactsProvider) {
      setContactsId(null);
    }
  }, [contactsId, contactsProvider]);

  const filtered = useMemo(() => {
    let list = providers;
    if (activeFilter === "active") list = list.filter((p) => p.active);
    if (activeFilter === "inactive") list = list.filter((p) => !p.active);
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.tradeName.toLowerCase().includes(q) ||
        p.companyName.toLowerCase().includes(q) ||
        p.cif.toLowerCase().includes(q) ||
        p.contactEmail.toLowerCase().includes(q)
    );
  }, [providers, query, activeFilter]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const getters: Record<string, (p: ProviderRecord) => string | boolean> = {
      tradeName: (p) => p.tradeName,
      companyName: (p) => p.companyName,
      cif: (p) => p.cif,
      contactEmail: (p) => p.contactEmail,
      active: (p) => p.active,
    };
    const get = getters[sort.key];
    if (!get) return filtered;
    return sortRows(filtered, sort.dir, get);
  }, [filtered, sort]);

  const handleSort = (key: string) => {
    setSort((s) => toggleColumnSort(s, key));
  };

  const openCreate = () => {
    setDialogMode("create");
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (p: ProviderRecord) => {
    setDialogMode("edit");
    setEditing(p);
    setDialogOpen(true);
  };

  const handleFormSubmit = async (values: ProviderFormValues) => {
    try {
      if (dialogMode === "create") {
        await createProvider({
          tradeName: values.tradeName,
          companyName: values.companyName,
          cif: values.cif,
          fiscalAddress: values.fiscalAddress,
          phone: values.phone,
          contactEmail: values.contactEmail,
          notes: values.notes ?? "",
          active: values.active,
        });
        toast({ title: t("admin.providers.toast_created") });
      } else if (editing) {
        await updateProvider(editing.id, {
          tradeName: values.tradeName,
          companyName: values.companyName,
          cif: values.cif,
          fiscalAddress: values.fiscalAddress,
          phone: values.phone,
          contactEmail: values.contactEmail,
          notes: values.notes ?? "",
          active: values.active,
        });
        toast({ title: t("admin.providers.toast_updated") });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.providers });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companyWorkers });
      setDialogOpen(false);
    } catch (e) {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.providers.toast_save_error"),
        variant: "destructive",
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await clearProviderLinksFromWorkers(deleteTarget.id);
      await deleteProvider(deleteTarget.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.providers });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companyWorkers });
      toast({ title: t("admin.providers.toast_deleted") });
      setDeleteTarget(null);
    } catch (e) {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.providers.toast_delete_error"),
        variant: "destructive",
      });
    }
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
        {error instanceof Error ? error.message : t("admin.providers.load_error")}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Truck className="h-7 w-7 text-primary" />
            {t("admin.providers.title")}
          </h2>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">{t("admin.providers.subtitle")}</p>
        </div>
        <Button className="gap-2 shrink-0" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t("admin.providers.new")}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">{t("admin.providers.list")}</CardTitle>
              <CardDescription>
                {t("admin.common.showing")} {sorted.length} {t("admin.common.of")} {providers.length}
              </CardDescription>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("admin.providers.search_ph")}
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
          </div>
        </CardHeader>
        <div className="px-6 pb-6 overflow-x-auto">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {query.trim() || activeFilter !== "all"
                ? t("admin.providers.empty_filter")
                : t("admin.providers.empty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    label={t("admin.providers.col_trade")}
                    columnKey="tradeName"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={t("admin.providers.col_company")}
                    columnKey="companyName"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={t("admin.providers.col_cif")}
                    columnKey="cif"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={t("admin.providers.col_contact")}
                    columnKey="contactEmail"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={t("admin.providers.col_status")}
                    columnKey="active"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <TableHead className="text-right w-[200px]">{t("admin.common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.tradeName}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {p.companyName}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{p.cif}</TableCell>
                    <TableCell>
                      <div className="text-sm">{p.contactEmail}</div>
                      <div className="text-xs text-muted-foreground">{p.phone}</div>
                    </TableCell>
                    <TableCell>
                      {p.active ? (
                        <Badge className="bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-600/20 border-0">
                          {t("admin.common.active")}
                        </Badge>
                      ) : (
                        <Badge variant="outline">{t("admin.common.inactive")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 mr-1"
                        onClick={() => setContactsId(p.id)}
                      >
                        <Users className="h-3.5 w-3.5" />
                        {t("admin.common.contacts")}
                        {p.contacts.length > 0 && (
                          <span className="tabular-nums">({p.contacts.length})</span>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(p)}
                        aria-label={t("admin.common.edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteTarget(p)}
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

      <ProviderFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        initial={editing}
        onSubmit={handleFormSubmit}
      />

      <ProviderContactsDialog
        provider={contactsProvider}
        open={!!contactsId && !!contactsProvider}
        onOpenChange={(o) => {
          if (!o) setContactsId(null);
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.providers.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.providers.delete_desc")} <strong>{deleteTarget?.tradeName}</strong>.{" "}
              {t("admin.providers.delete_desc_suffix")}
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

export default AdminProviders;
