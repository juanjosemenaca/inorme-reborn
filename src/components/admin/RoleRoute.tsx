import { Navigate } from "react-router-dom";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import type { UserRole, WorkerModuleKey } from "@/types/backoffice";

function normalizeRole(value: unknown): UserRole | null {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (raw === "ADMIN") return "ADMIN";
  if (raw === "WORKER") return "WORKER";
  return null;
}

/**
 * Solo renderiza children si el usuario tiene uno de los roles permitidos.
 * Si no, redirige al panel (o podrías usar una página 403).
 */
export function RoleRoute({
  children,
  allowedRoles,
  requiredModule,
}: {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  requiredModule?: WorkerModuleKey;
}) {
  const { user } = useAdminAuth();
  const role = normalizeRole(user?.role);
  const hasModule =
    !requiredModule || user?.enabledModules?.includes(requiredModule) === true;
  const canAccess = role !== null && allowedRoles.includes(role) && hasModule;

  if (!user || !canAccess) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
