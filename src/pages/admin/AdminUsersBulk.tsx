import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Loader2, UserPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInputWithToggle } from "@/components/ui/password-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useBackofficeUsers } from "@/hooks/useBackofficeUsers";
import { useCompanyWorkers } from "@/hooks/useCompanyWorkers";
import {
  bulkCreateUsersFromWorkers,
  DEFAULT_BULK_INITIAL_PASSWORD,
} from "@/api/backofficeUsersApi";
import { companyWorkerDisplayName } from "@/types/companyWorkers";
import type { UserRole } from "@/types/backoffice";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/queryKeys";
import type { BulkCreateUsersResult } from "@/api/backofficeUsersApi";
import { isWorkerEligibleForNewBackofficeUser } from "@/lib/workerBackofficeUserEligibility";

const AdminUsersBulk = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: users = [], isLoading: loadingUsers } = useBackofficeUsers();
  const { data: companyWorkers = [], isLoading: loadingWorkers } = useCompanyWorkers();

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [password, setPassword] = useState(DEFAULT_BULK_INITIAL_PASSWORD);
  const [role, setRole] = useState<UserRole>("WORKER");
  const [running, setRunning] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [lastResult, setLastResult] = useState<BulkCreateUsersResult | null>(null);

  const withoutUser = useMemo(
    () => companyWorkers.filter((w) => isWorkerEligibleForNewBackofficeUser(w, users)),
    [companyWorkers, users]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return withoutUser;
    return withoutUser.filter((w) => {
      const name = companyWorkerDisplayName(w);
      const hay = [name, w.dni, w.email, w.mobile, w.city].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [withoutUser, query]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((w) => selected.has(w.id));

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((w) => next.delete(w.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((w) => next.add(w.id));
        return next;
      });
    }
  };

  const runBulk = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      toast({
        title: t("admin.common.error"),
        description: t("admin.usersBulk.none_selected"),
        variant: "destructive",
      });
      return;
    }
    setRunning(true);
    try {
      const res = await bulkCreateUsersFromWorkers(ids, { password, role, active: true });
      setLastResult(res);
      setResultOpen(true);
      setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeUsers });
      if (res.success.length > 0 || res.failed.length > 0) {
        toast({
          title: t("admin.usersBulk.toast_done_summary")
            .replace("{ok}", String(res.success.length))
            .replace("{fail}", String(res.failed.length)),
        });
      }
    } catch (e) {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.users.operation_failed"),
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const loading = loadingUsers || loadingWorkers;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        {t("admin.common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1100px]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2 w-fit" asChild>
            <Link to="/admin/usuarios">
              <ArrowLeft className="h-4 w-4" />
              {t("admin.usersBulk.back")}
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{t("admin.usersBulk.title")}</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">{t("admin.usersBulk.subtitle")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.usersBulk.options_title")}</CardTitle>
          <CardDescription>{t("admin.usersBulk.options_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row flex-wrap gap-6">
          <div className="space-y-2 min-w-[200px]">
            <Label htmlFor="bulk-password">{t("admin.usersBulk.password_label")}</Label>
            <PasswordInputWithToggle
              id="bulk-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">{t("admin.usersBulk.password_hint")}</p>
          </div>
          <div className="space-y-2 min-w-[180px]">
            <Label>{t("admin.usersBulk.role_label")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WORKER">{t("admin.users.filter_role_worker")}</SelectItem>
                <SelectItem value="ADMIN">{t("admin.users.filter_role_admin")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">{t("admin.usersBulk.table_title")}</CardTitle>
              <CardDescription>
                {t("admin.common.showing")} {filtered.length} / {withoutUser.length}
              </CardDescription>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Input
                placeholder={t("admin.usersBulk.search_ph")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {withoutUser.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t("admin.usersBulk.empty_all_have_user")}
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t("admin.usersBulk.empty_filter")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[48px]">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={() => toggleAllFiltered()}
                      aria-label={t("admin.usersBulk.select_all")}
                    />
                  </TableHead>
                  <TableHead>{t("admin.users.col_name")}</TableHead>
                  <TableHead>{t("admin.users.col_dni")}</TableHead>
                  <TableHead>{t("admin.users.col_email")}</TableHead>
                  <TableHead>{t("admin.users.col_mobile")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((w) => {
                  const noEmail = !w.email.trim();
                  return (
                    <TableRow key={w.id} className={noEmail ? "opacity-50" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(w.id)}
                          disabled={noEmail}
                          onCheckedChange={(c) => toggleOne(w.id, c === true)}
                          aria-label={companyWorkerDisplayName(w)}
                        />
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">
                        {companyWorkerDisplayName(w)}
                      </TableCell>
                      <TableCell>{w.dni}</TableCell>
                      <TableCell className="max-w-[220px] truncate">
                        {noEmail ? (
                          <span className="text-amber-700 dark:text-amber-300 text-xs">
                            {t("admin.usersBulk.no_email")}
                          </span>
                        ) : (
                          w.email
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{w.mobile}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3 items-center">
        <Button
          size="lg"
          className="gap-2"
          disabled={running || selected.size === 0}
          onClick={() => void runBulk()}
        >
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          {t("admin.usersBulk.submit").replace("{count}", String(selected.size))}
        </Button>
        <span className="text-sm text-muted-foreground">
          {t("admin.usersBulk.selected_count").replace("{count}", String(selected.size))}
        </span>
      </div>

      <AlertDialog open={resultOpen} onOpenChange={setResultOpen}>
        <AlertDialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.usersBulk.result_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.usersBulk.result_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          {lastResult && (
            <div className="space-y-4 text-sm">
              <div className="rounded-md border bg-muted/40 p-3 space-y-2">
                <p className="font-medium">{t("admin.usersBulk.result_password_label")}</p>
                <div className="flex gap-2 items-center">
                  <code className="text-xs bg-background px-2 py-1 rounded border flex-1 break-all">
                    {lastResult.initialPassword}
                  </code>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    title={t("admin.users.initial_password_copy")}
                    onClick={() => void navigator.clipboard.writeText(lastResult.initialPassword)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {lastResult.success.length > 0 && (
                <div>
                  <p className="font-medium text-emerald-700 dark:text-emerald-400 mb-1">
                    {t("admin.usersBulk.result_ok").replace("{count}", String(lastResult.success.length))}
                  </p>
                  <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                    {lastResult.success.map((s) => (
                      <li key={s.email}>
                        {s.name} — {s.email}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {lastResult.failed.length > 0 && (
                <div>
                  <p className="font-medium text-destructive mb-1">
                    {t("admin.usersBulk.result_fail").replace("{count}", String(lastResult.failed.length))}
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    {lastResult.failed.map((f) => (
                      <li key={f.companyWorkerId}>
                        {f.name || f.companyWorkerId}
                        {f.email ? ` — ${f.email}` : ""}: {f.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setResultOpen(false)}>
              {t("admin.common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsersBulk;
