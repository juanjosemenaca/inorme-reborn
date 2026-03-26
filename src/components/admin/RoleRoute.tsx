import { Navigate } from "react-router-dom";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import type { UserRole } from "@/types/backoffice";

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
}: {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}) {
  const { user } = useAdminAuth();
  const role = normalizeRole(user?.role);
  const canAccess = role !== null && allowedRoles.includes(role);

  if (!user || !canAccess) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
