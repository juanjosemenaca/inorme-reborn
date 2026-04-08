import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Plus,
  Pencil,
  Trash2,
  UserX,
  UserCheck,
  Loader2,
  Search,
  Filter,
  KeyRound,
  Copy,
  UserPlus,
} from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { useBackofficeUsers } from "@/hooks/useBackofficeUsers";
import { useCompanyWorkers } from "@/hooks/useCompanyWorkers";
import {
  createUser,
  updateUser,
  deleteUser,
  countAdmins,
} from "@/api/backofficeUsersApi";
import type { BackofficeUserRecord, UserRole } from "@/types/backoffice";
import { getResolvedDisplayName } from "@/types/backoffice";
import {
  UserFormDialog,
  type UserCreateFormValues,
  type UserEditFormValues,
} from "@/components/admin/UserFormDialog";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/queryKeys";
import { nextPasswordRenewalDeadline } from "@/lib/passwordPolicy";
import {
  isWorkerEligibleForNewBackofficeUser,
  isWorkerEligibleForBackofficeUserEdit,
} from "@/lib/workerBackofficeUserEligibility";

function initialsFromDisplayName(name: string) {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase() || "??";
}

const AdminUsers = () => {
  const queryClient = useQueryClient();
  const { data: users = [], isLoading, isError, error } = useBackofficeUsers();
  const { data: companyWorkers = [] } = useCompanyWorkers();
  const { user: session, refreshSession } = useAdminAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<BackofficeUserRecord | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<BackofficeUserRecord | null>(null);
  const [initialPasswordReveal, setInitialPasswordReveal] = useState<string | null>(null);
  const [forceTarget, setForceTarget] = useState<BackofficeUserRecord | null>(null);

  const localeTag =
    language === "en" ? "en-GB" : language === "ca" ? "ca-ES" : "es-ES";

  const formatShortDate = (iso: string | null) => {
    if (!iso) return t("admin.common.none");
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return t("admin.common.none");
    return d.toLocaleDateString(localeTag, { day: "2-digit", month: "short", year: "numeric" });
  };

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [sort, setSort] = useState<ColumnSort | null>({ key: "displayName", dir: "asc" });

  const filteredUsers = useMemo(() => {
    let list = users;
    if (roleFilter !== "all") list = list.filter((u) => u.role === roleFilter);
    if (activeFilter === "active") list = list.filter((u) => u.active);
    if (activeFilter === "inactive") list = list.filter((u) => !u.active);
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) => {
      const name = getResolvedDisplayName(u, companyWorkers);
      const hay = [name, u.email, u.dni, u.mobile].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [users, companyWorkers, query, roleFilter, activeFilter]);

  const sortedUsers = useMemo(() => {
    if (!sort) return filteredUsers;
    const getters: Record<string, (u: BackofficeUserRecord) => string | boolean> = {
      displayName: (u) => getResolvedDisplayName(u, companyWorkers),
      email: (u) => u.email,
      dni: (u) => u.dni,
      mobile: (u) => u.mobile,
      employmentType: (u) => t(`admin.workers.emp.${u.employmentType}`),
      role: (u) =>
        t(u.role === "ADMIN" ? "admin.users.role_admin_short" : "admin.users.role_worker_short"),
      active: (u) => u.active,
    };
    const get = getters[sort.key];
    if (!get) return filteredUsers;
    return sortRows(filteredUsers, sort.dir, get);
  }, [filteredUsers, sort, companyWorkers, t]);

  const handleSort = (key: string) => {
    setSort((s) => toggleColumnSort(s, key));
  };

  const selectableWorkers = useMemo(
    () => companyWorkers.filter((w) => isWorkerEligibleForNewBackofficeUser(w, users)),
    [companyWorkers, users]
  );

  const selectableWorkersForEdit = useMemo(() => {
    if (!editing) return [];
    return companyWorkers.filter((w) => isWorkerEligibleForBackofficeUserEdit(w, users, editing.id));
  }, [companyWorkers, users, editing]);

  const openCreate = () => {
    setDialogMode("create");
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (u: BackofficeUserRecord) => {
    setDialogMode("edit");
    setEditing(u);
    setDialogOpen(true);
  };

  const handleSubmitCreate = async (values: UserCreateFormValues) => {
    try {
      const { initialPassword } = await createUser({
        companyWorkerId: values.companyWorkerId,
        email: values.email,
        password: values.password,
        role: values.role,
        active: values.active,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeUsers });
      toast({ title: t("admin.users.toast_created") });
      setDialogOpen(false);
      setInitialPasswordReveal(initialPassword);
    } catch (e) {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.users.operation_failed"),
        variant: "destructive",
      });
    }
  };

  const handleSubmitEdit = async (values: UserEditFormValues) => {
    if (!editing) return;
    try {
      const admins = await countAdmins();
      const isLastAdmin =
        editing.role === "ADMIN" && admins === 1 && values.role === "WORKER";
      if (isLastAdmin) {
        toast({
          title: t("admin.workers.delete_blocked_title"),
          description: t("admin.users.toast_last_admin_role"),
          variant: "destructive",
        });
        return;
      }
      await updateUser(
        editing.id,
        {
          email: values.email,
          role: values.role,
          active: values.active,
          companyWorkerId: values.companyWorkerId.trim() || null,
          password: values.password && values.password.length > 0 ? values.password : undefined,
        },
        { isSelf: session?.userId === editing.id }
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeUsers });
      toast({ title: t("admin.users.toast_updated") });
      setDialogOpen(false);
      if (session?.userId === editing.id) {
        await refreshSession();
      }
    } catch (e) {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.users.operation_failed"),
        variant: "destructive",
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (session?.userId === deleteTarget.id) {
      toast({
        title: t("admin.workers.delete_blocked_title"),
        description: t("admin.users.toast_self_delete"),
        variant: "destructive",
      });
      setDeleteTarget(null);
      return;
    }
    try {
      await deleteUser(deleteTarget.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeUsers });
      toast({ title: t("admin.users.toast_deleted") });
    } catch (e) {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.users.operation_failed"),
        variant: "destructive",
      });
    }
    setDeleteTarget(null);
  };

  const confirmForcePasswordChange = async () => {
    if (!forceTarget) return;
    try {
      await updateUser(forceTarget.id, { forcePasswordChange: true });
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeUsers });
      toast({ title: t("admin.users.toast_force_change") });
    } catch (e) {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.users.operation_failed"),
        variant: "destructive",
      });
    }
    setForceTarget(null);
  };

  const toggleActive = async (u: BackofficeUserRecord) => {
    if (session?.userId === u.id && u.active) {
      toast({
        title: t("admin.workers.delete_blocked_title"),
        description: t("admin.users.toast_self_deactivate"),
        variant: "destructive",
      });
      return;
    }
    const admins = await countAdmins();
    if (u.role === "ADMIN" && u.active && admins === 1) {
      toast({
        title: t("admin.workers.delete_blocked_title"),
        description: t("admin.users.toast_last_admin_deactivate"),
        variant: "destructive",
      });
      return;
    }
    try {
      await updateUser(u.id, { active: !u.active }, { isSelf: session?.userId === u.id });
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeUsers });
      toast({
        title: u.active ? t("admin.users.toast_deactivated") : t("admin.users.toast_reactivated"),
      });
      if (session?.userId === u.id) await refreshSession();
    } catch (e) {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.users.operation_failed"),
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
        {error instanceof Error ? error.message : t("admin.users.load_error")}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("admin.users.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
            {t("admin.users.subtitle")} <strong>{t("admin.users.subtitle_strong")}</strong>{" "}
            {t("admin.users.subtitle_mid")} <strong>{t("admin.users.subtitle_strong2")}</strong>
            {t("admin.users.subtitle_end")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="outline" asChild className="gap-2">
            <Link to="/admin/usuarios/alta-masiva">
              <UserPlus className="h-4 w-4" />
              {t("admin.users.bulk_link")}
            </Link>
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("admin.users.new")}
          </Button>
        </div>
      </div>

      <Card className="border-primary/15 bg-gradient-to-br from-card to-primary/5">
        <CardHeader>
          <CardTitle className="text-base">{t("admin.users.card_title")}</CardTitle>
          <CardDescription>
            {t("admin.users.card_desc")} <strong>{t("admin.users.card_desc_strong")}</strong>
            {t("admin.users.card_desc_end")}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="shadow-sm border-slate-200/80">
        <CardHeader className="space-y-4 pb-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">{t("admin.users.directory")}</CardTitle>
              <CardDescription>
                {t("admin.common.showing")} {sortedUsers.length} {t("admin.common.of")} {users.length}
              </CardDescription>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("admin.users.search_ph")}
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
              <label className="text-xs text-muted-foreground">{t("admin.users.filter_role")}</label>
              <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as "all" | UserRole)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.common.filter_all")}</SelectItem>
                  <SelectItem value="ADMIN">{t("admin.users.filter_role_admin")}</SelectItem>
                  <SelectItem value="WORKER">{t("admin.users.filter_role_worker")}</SelectItem>
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
          {sortedUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {query.trim() || roleFilter !== "all" || activeFilter !== "all"
                ? t("admin.users.empty_filter")
                : t("admin.users.empty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[48px]" />
                  <SortableTableHead
                    label={t("admin.users.col_name")}
                    columnKey="displayName"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={t("admin.users.col_email")}
                    columnKey="email"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={t("admin.users.col_dni")}
                    columnKey="dni"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={t("admin.users.col_mobile")}
                    columnKey="mobile"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={t("admin.users.col_type")}
                    columnKey="employmentType"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={t("admin.users.col_role")}
                    columnKey="role"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={t("admin.users.col_status")}
                    columnKey="active"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <TableHead className="min-w-[150px] whitespace-normal">
                    {t("admin.users.col_password_policy")}
                  </TableHead>
                  <TableHead className="text-right min-w-[220px]">{t("admin.common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedUsers.map((u) => {
                const displayName = getResolvedDisplayName(u, companyWorkers);
                return (
                  <TableRow key={u.id} className={!u.active ? "opacity-60" : undefined}>
                    <TableCell>
                      <Avatar className="h-9 w-9 border">
                        <AvatarFallback
                          className={
                            u.role === "ADMIN"
                              ? "bg-primary/15 text-primary text-xs font-semibold"
                              : "bg-muted text-xs font-semibold"
                          }
                        >
                          {initialsFromDisplayName(displayName)}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{displayName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[180px] truncate">
                      {u.email}
                    </TableCell>
                    <TableCell className="text-sm">{u.dni}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{u.mobile}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {t(`admin.workers.emp.${u.employmentType}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>
                        {u.role === "ADMIN"
                          ? t("admin.users.role_admin_short")
                          : t("admin.users.role_worker_short")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.active ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600">{t("admin.common.active")}</Badge>
                      ) : (
                        <Badge variant="secondary">{t("admin.common.inactive")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm align-top">
                      <div className="space-y-1 max-w-[220px]">
                        {u.mustChangePassword ? (
                          <Badge
                            variant="outline"
                            className="font-normal border-amber-600/50 text-amber-900 dark:text-amber-200"
                          >
                            {t("admin.users.must_change_badge")}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">
                            {formatShortDate(u.passwordChangedAt)}
                          </span>
                        )}
                        {!u.mustChangePassword && u.passwordChangedAt ? (() => {
                          const deadline = nextPasswordRenewalDeadline(u.passwordChangedAt);
                          if (!deadline) return null;
                          const overdue = deadline.getTime() < Date.now();
                          return (
                            <p
                              className={
                                overdue ? "text-xs text-destructive" : "text-xs text-muted-foreground"
                              }
                            >
                              {overdue
                                ? t("admin.users.renewal_overdue")
                                : `${t("admin.users.renewal_due")} ${formatShortDate(deadline.toISOString())}`}
                            </p>
                          );
                        })() : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(u)}
                          title={t("admin.common.edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {session?.role === "ADMIN" && session?.userId !== u.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setForceTarget(u)}
                            title={t("admin.users.force_change")}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => void toggleActive(u)}
                          title={u.active ? t("admin.users.title_deactivate") : t("admin.users.title_reactivate")}
                        >
                          {u.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(u)}
                          title={t("admin.users.title_delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            </Table>
          )}
        </div>
      </Card>

      <UserFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        initial={editing}
        selectableWorkers={selectableWorkers}
        selectableWorkersForEdit={selectableWorkersForEdit}
        onSubmitCreate={handleSubmitCreate}
        onSubmitEdit={handleSubmitEdit}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.users.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.users.delete_desc")}{" "}
              <strong>
                {deleteTarget ? getResolvedDisplayName(deleteTarget, companyWorkers) : ""}
              </strong>
              . {t("admin.users.delete_desc_suffix")}
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

      <AlertDialog open={!!initialPasswordReveal} onOpenChange={(o) => !o && setInitialPasswordReveal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.users.initial_password_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.users.initial_password_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={initialPasswordReveal ?? ""} className="font-mono text-sm" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              title={t("admin.users.initial_password_copy")}
              onClick={() => {
                if (initialPasswordReveal) void navigator.clipboard.writeText(initialPasswordReveal);
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setInitialPasswordReveal(null)}>
              {t("admin.common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!forceTarget} onOpenChange={(o) => !o && setForceTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.users.force_change_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.users.force_change_desc")}{" "}
              <strong>
                {forceTarget ? getResolvedDisplayName(forceTarget, companyWorkers) : ""}
              </strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmForcePasswordChange()}>
              {t("admin.common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsers;
