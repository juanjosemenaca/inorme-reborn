import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Layers, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBackofficeUsers } from "@/hooks/useBackofficeUsers";
import { useLanguage } from "@/contexts/LanguageContext";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/hooks/use-toast";
import {
  bulkUpdateWorkerModules,
  updateWorkerModules,
} from "@/api/backofficeUsersApi";
import { ALL_WORKER_MODULES, type WorkerModuleKey } from "@/types/backoffice";

const MODULE_ORDER: WorkerModuleKey[] = ["VACATIONS", "MESSAGES", "TIME_CLOCK", "AGENDA", "GASTOS"];

function moduleLabel(module: WorkerModuleKey, t: (key: string) => string): string {
  if (module === "VACATIONS") return t("admin.moduleActivation.mod_vacations");
  if (module === "MESSAGES") return t("admin.moduleActivation.mod_messages");
  if (module === "TIME_CLOCK") return t("admin.moduleActivation.mod_time_clock");
  if (module === "AGENDA") return t("admin.moduleActivation.mod_agenda");
  return t("admin.moduleActivation.mod_expenses");
}

const AdminUserModuleActivation = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: users = [], isLoading, isError, error } = useBackofficeUsers();
  const [query, setQuery] = useState("");
  const [bulkTarget, setBulkTarget] = useState<"ALL_WORKERS" | "ONLY_ACTIVE_WORKERS">("ALL_WORKERS");
  const [bulkModules, setBulkModules] = useState<WorkerModuleKey[]>([...ALL_WORKER_MODULES]);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  const workers = useMemo(
    () =>
      users
        .filter((u) => u.role === "WORKER" || u.role === "ADMIN")
        .filter((u) => {
          const q = query.trim().toLowerCase();
          if (!q) return true;
          return [u.firstName, u.lastName, u.email].join(" ").toLowerCase().includes(q);
        }),
    [users, query]
  );

  const updateOne = async (userId: string, nextModules: WorkerModuleKey[]) => {
    try {
      setSavingUserId(userId);
      await updateWorkerModules(userId, nextModules);
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeUsers });
      toast({ title: t("admin.moduleActivation.toast_saved") });
    } catch (e) {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.moduleActivation.toast_save_error"),
        variant: "destructive",
      });
    } finally {
      setSavingUserId(null);
    }
  };

  const applyBulk = async () => {
    try {
      setBulkSaving(true);
      await bulkUpdateWorkerModules(bulkModules, bulkTarget);
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeUsers });
      toast({ title: t("admin.moduleActivation.toast_bulk_saved") });
    } catch (e) {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.moduleActivation.toast_save_error"),
        variant: "destructive",
      });
    } finally {
      setBulkSaving(false);
    }
  };

  const toggleBulkModule = (module: WorkerModuleKey) => {
    setBulkModules((prev) =>
      prev.includes(module) ? prev.filter((m) => m !== module) : [...prev, module]
    );
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
        {error instanceof Error ? error.message : t("admin.moduleActivation.load_error")}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Layers className="h-6 w-6 text-primary" />
          {t("admin.moduleActivation.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t("admin.moduleActivation.subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.moduleActivation.bulk_title")}</CardTitle>
          <CardDescription>{t("admin.moduleActivation.bulk_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={bulkTarget === "ALL_WORKERS" ? "default" : "outline"}
              onClick={() => setBulkTarget("ALL_WORKERS")}
            >
              {t("admin.moduleActivation.bulk_all_workers")}
            </Button>
            <Button
              type="button"
              variant={bulkTarget === "ONLY_ACTIVE_WORKERS" ? "default" : "outline"}
              onClick={() => setBulkTarget("ONLY_ACTIVE_WORKERS")}
            >
              {t("admin.moduleActivation.bulk_active_workers")}
            </Button>
          </div>
          <div className="flex flex-wrap gap-4">
            {MODULE_ORDER.map((mod) => (
              <label key={mod} className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={bulkModules.includes(mod)}
                  onChange={() => toggleBulkModule(mod)}
                />
                {moduleLabel(mod, t)}
              </label>
            ))}
          </div>
          <div className="flex justify-end">
            <Button type="button" disabled={bulkSaving} onClick={applyBulk}>
              {t("admin.moduleActivation.bulk_apply")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.moduleActivation.users_title")}</CardTitle>
          <CardDescription>{t("admin.moduleActivation.users_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("admin.moduleActivation.search_placeholder")}
          />
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.moduleActivation.col_user")}</TableHead>
                  <TableHead>{t("admin.moduleActivation.col_modules")}</TableHead>
                  <TableHead className="text-right">{t("admin.common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      {t("admin.moduleActivation.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  workers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{`${u.firstName} ${u.lastName}`.trim()}</p>
                            {u.role === "ADMIN" ? (
                              <Badge variant="secondary" className="text-[10px]">
                                {t("admin.layout.badge_admin")}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                          {!u.active ? <Badge variant="outline">{t("admin.common.inactive")}</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-3">
                          {MODULE_ORDER.map((mod) => {
                            const checked = u.enabledModules.includes(mod);
                            const next = checked
                              ? u.enabledModules.filter((m) => m !== mod)
                              : [...u.enabledModules, mod];
                            return (
                              <label key={`${u.id}-${mod}`} className="inline-flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={savingUserId === u.id}
                                  onChange={() => updateOne(u.id, next)}
                                />
                                {moduleLabel(mod, t)}
                              </label>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {savingUserId === u.id ? <Loader2 className="h-4 w-4 animate-spin inline-block" /> : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUserModuleActivation;
