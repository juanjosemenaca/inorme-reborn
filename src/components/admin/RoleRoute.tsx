import { Navigate } from "react-router-dom";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import type { UserRole } from "@/types/backoffice";

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

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
