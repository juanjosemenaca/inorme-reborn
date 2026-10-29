import { requireSupabase } from "@/api/supabaseRequire";
import { canUseSource } from "@/lib/dashboard/widgetConfig";
import type { DashboardSource } from "@/lib/dashboard/catalog";
import type { UserRole, WorkerModuleKey } from "@/types/backoffice";

export type DashboardActor = {
  userId: string;
  role: UserRole;
  modules: WorkerModuleKey[];
  companyWorkerId: string | null;
};

/**
 * Perfil de la sesión autenticada. Nunca usar un `role` enviado por React.
 */
export async function resolveDashboardActor(): Promise<DashboardActor> {
  const sb = requireSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sesión no válida.");
  const { data, error } = await sb
    .from("backoffice_users")
    .select("id, role, enabled_modules, company_worker_id")
    .eq("auth_user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No se encontró el perfil.");
  return {
    userId: data.id as string,
    role: data.role as UserRole,
    modules: (data.enabled_modules ?? []) as WorkerModuleKey[],
    companyWorkerId: (data.company_worker_id as string | null) ?? null,
  };
}

/** Ignora cualquier rol reclamado por el cliente. */
export function expenseOwnerFilter(session: DashboardActor): { all: true } | { ownerId: string } | { none: true } {
  if (session.role === "ADMIN") return { all: true };
  if (!session.companyWorkerId) return { none: true };
  return { ownerId: session.companyWorkerId };
}

export function widgetSourceAccess(
  session: DashboardActor,
  source: string | undefined
): "ok" | "unknown_source" | "module_required" {
  if (!source) return "unknown_source";
  if (source !== "billing" && source !== "expenses" && source !== "projects" && source !== "clients") {
    return "unknown_source";
  }
  if (!canUseSource(source as DashboardSource, session.role, session.modules)) return "module_required";
  return "ok";
}

export function canAttachSchedule(scheduleUserId: string, widget: { userId: string } | null): boolean {
  if (!widget) return false;
  return widget.userId === scheduleUserId;
}
