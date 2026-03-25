import { Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

/**
 * Redirige a /admin/cambiar-contrasena mientras la política exija cambio de contraseña.
 */
export function PasswordChangeGate({ children }: { children: React.ReactNode }) {
  const { needsPasswordChange, ready, isAuthenticated } = useAdminAuth();
  const location = useLocation();

  if (!ready || !isAuthenticated) {
    return <>{children}</>;
  }

  if (needsPasswordChange && location.pathname !== "/admin/cambiar-contrasena") {
    return <Navigate to="/admin/cambiar-contrasena" replace />;
  }

  return <>{children}</>;
}
