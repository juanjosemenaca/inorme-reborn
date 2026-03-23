import { Loader2 } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, ready } = useAdminAuth();
  const { t } = useLanguage();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
        <span className="sr-only">{t("admin.common.loading_session")}</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
