import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Pencil, Trash2, Users, Search, Loader2, Filter } from "lucide-react";
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
import { useClients } from "@/hooks/useClients";
import { createClient, deleteClient, updateClient } from "@/api/clientsApi";
import { queryKeys } from "@/lib/queryKeys";
import type { ClientKind, ClientRecord } from "@/types/clients";
import { ClientFormDialog, type ClientFormValues } from "@/components/admin/ClientFormDialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { ClientContactsDialog } from "@/components/admin/ClientContactsDialog";
import { useToast } from "@/hooks/use-toast";

const AdminClients = () => {
  const queryClient = useQueryClient();
  const { data: clients = [], isLoading, isError, error } = useClients();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | ClientKind>("all");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [sort, setSort] = useState<ColumnSort | null>({ key: "tradeName", dir: "asc" });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<ClientRecord | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ClientRecord | null>(null);

  const [contactsClientId, setContactsClientId] = useState<string | null>(null);
  const contactsClient = useMemo(
    () => clients.find((c) => c.id === contactsClientId) ?? null,
    [clients, contactsClientId]
  );

  useEffect(() => {
    if (contactsClientId && !contactsClient) {
      setContactsClientId(null);
    }
  }, [contactsClientId, contactsClient]);

  const finalClientOptions = useMemo(() => {
    return clients
      .filter((c) => c.clientKind === "FINAL" && c.id !== editing?.id)
      .map((c) => ({
        id: c.id,
        label: `${c.tradeName} — ${c.companyName}`,
      }));
  }, [clients, editing]);

  const filtered = useMemo(() => {
    let list = clients;
    if (kindFilter !== "all") list = list.filter((c) => c.clientKind === kindFilter);
    if (activeFilter === "active") list = list.filter((c) => c.active);
    if (activeFilter === "inactive") list = list.filter((c) => !c.active);

    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => {
      const linkedName =
        c.linkedFinalClientId &&
        clients.find((x) => x.id === c.linkedFinalClientId)?.tradeName;
      const hay = [
        c.tradeName,
        c.companyName,
        c.cif,
        c.contactEmail,
        linkedName ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [clients, query, kindFilter, activeFilter]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const linkedName = (c: ClientRecord) =>
      c.linkedFinalClientId
        ? clients.find((x) => x.id === c.linkedFinalClientId)?.tradeName ?? ""
        : "";
    const getters: Record<string, (c: ClientRecord) => string | boolean> = {
      tradeName: (c) => c.tradeName,
      companyName: (c) => c.companyName,
      cif: (c) => c.cif,
      clientKind: (c) =>
        t(c.clientKind === "FINAL" ? "admin.clients.kind_final" : "admin.clients.kind_intermediary"),
      linkedFinal: (c) => linkedName(c),
      contactEmail: (c) => c.contactEmail,
      active: (c) => c.active,
    };
    const get = getters[sort.key];
    if (!get) return filtered;
    return sortRows(filtered, sort.dir, get);
  }, [filtered, sort, clients, t]);

  const handleSort = (key: string) => {
    setSort((s) => toggleColumnSort(s, key));
  };

  const openCreate = () => {
    setDialogMode("create");
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (c: ClientRecord) => {
    setDialogMode("edit");
    setEditing(c);
    setDialogOpen(true);
  };

  const handleFormSubmit = async (values: ClientFormValues) => {
    try {
      if (dialogMode === "create") {
        await createClient({
          tradeName: values.tradeName,
          companyName: values.companyName,
          cif: values.cif,
          postalAddress: values.postalAddress,
          fiscalAddress: values.fiscalAddress,
          clientKind: values.clientKind,
          linkedFinalClientId:
            values.clientKind === "INTERMEDIARIO"
              ? values.linkedFinalClientId?.trim() || null
              : null,
          phone: values.phone,
          contactEmail: values.contactEmail,
          websiteUrl: values.website?.trim() ?? "",
          notes: values.notes ?? "",
          invoiceAddresseeLine: values.invoiceAddresseeLine,
          active: values.active,
        });
        toast({ title: t("admin.clients.toast_created") });
      } else if (editing) {
        await updateClient(editing.id, {
          tradeName: values.tradeName,
          companyName: values.companyName,
          cif: values.cif,
          postalAddress: values.postalAddress,
          fiscalAddress: values.fiscalAddress,
          clientKind: values.clientKind,
          linkedFinalClientId:
            values.clientKind === "INTERMEDIARIO"
              ? values.linkedFinalClientId?.trim() || null
              : null,
          phone: values.phone,
          contactEmail: values.contactEmail,
          websiteUrl: values.website?.trim() ?? "",
          notes: values.notes ?? "",
          invoiceAddresseeLine: values.invoiceAddresseeLine,
          active: values.active,
        });
        toast({ title: t("admin.clients.toast_updated") });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.clients });
      setDialogOpen(false);
    } catch (e) {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.clients.toast_save_error"),
        variant: "destructive",
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteClient(deleteTarget.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.clients });
      toast({ title: t("admin.clients.toast_deleted") });
      setDeleteTarget(null);
    } catch (e) {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.clients.toast_delete_error"),
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
        {error instanceof Error ? error.message : t("admin.clients.load_error")}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" />
            {t("admin.clients.title")}
          </h2>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">{t("admin.clients.subtitle")}</p>
        </div>
        <Button className="gap-2 shrink-0" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t("admin.clients.new")}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">{t("admin.clients.list")}</CardTitle>
              <CardDescription>
                {t("admin.common.showing")} {sorted.length} {t("admin.common.of")} {clients.length}
              </CardDescription>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("admin.clients.search_ph")}
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
            <div className="space-y-1 min-w-[160px]">
              <label className="text-xs text-muted-foreground">{t("admin.clients.filter_kind")}</label>
              <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as "all" | ClientKind)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t("admin.common.filter_all")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.common.filter_all")}</SelectItem>
                  <SelectItem value="FINAL">{t("admin.clients.kind_final")}</SelectItem>
                  <SelectItem value="INTERMEDIARIO">{t("admin.clients.kind_intermediary")}</SelectItem>
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
          </div>
        </CardHeader>
        <div className="px-6 pb-6 overflow-x-auto">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {query.trim() || kindFilter !== "all" || activeFilter !== "all"
                ? t("admin.clients.empty_filter")
                : t("admin.clients.empty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    label={t("admin.clients.col_trade")}
                    columnKey="tradeName"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={t("admin.clients.col_company")}
                    columnKey="companyName"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={t("admin.clients.col_cif")}
                    columnKey="cif"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={t("admin.clients.col_kind")}
                    columnKey="clientKind"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={t("admin.clients.col_final_client")}
                    columnKey="linkedFinal"
                    currentSort={sort}
                    onSort={handleSort}
                    className="min-w-[140px]"
                  />
                  <SortableTableHead
                    label={t("admin.clients.col_contact")}
                    columnKey="contactEmail"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={t("admin.clients.col_status")}
                    columnKey="active"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <TableHead className="text-right w-[200px]">{t("admin.common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.tradeName}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {c.companyName}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{c.cif}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {t(
                          c.clientKind === "FINAL"
                            ? "admin.clients.kind_final"
                            : "admin.clients.kind_intermediary"
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {c.clientKind === "INTERMEDIARIO" ? (
                        c.linkedFinalClientId ? (
                          <span className="text-sm">
                            {clients.find((x) => x.id === c.linkedFinalClientId)?.tradeName ?? "—"}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            {t("admin.clients.final_not_set")}
                          </span>
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{c.contactEmail}</div>
                      <div className="text-xs text-muted-foreground">{c.phone}</div>
                    </TableCell>
                    <TableCell>
                      {c.active ? (
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
                        onClick={() => setContactsClientId(c.id)}
                      >
                        <Users className="h-3.5 w-3.5" />
                        {t("admin.common.contacts")}
                        {c.contacts.length > 0 && (
                          <span className="tabular-nums">({c.contacts.length})</span>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(c)}
                        aria-label={t("admin.common.edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteTarget(c)}
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

      <ClientFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        initial={editing}
        finalClientOptions={finalClientOptions}
        onSubmit={handleFormSubmit}
      />

      <ClientContactsDialog
        client={contactsClient}
        open={!!contactsClientId && !!contactsClient}
        onOpenChange={(o) => {
          if (!o) setContactsClientId(null);
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.clients.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.clients.delete_desc")} <strong>{deleteTarget?.tradeName}</strong>{" "}
              {t("admin.clients.delete_desc_suffix")}
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

export default AdminClients;
