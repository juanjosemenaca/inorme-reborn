import { Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { AdminDashboardAdmin } from "@/components/admin/AdminDashboardAdmin";

const AdminDashboard = () => {
  const { user, isAdmin, isWorker } = useAdminAuth();
  const { t } = useLanguage();

  if (isAdmin && user) {
    return <AdminDashboardAdmin session={user} />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("admin.dashboard.worker_title")}</h2>
        <p className="text-muted-foreground text-sm mt-1">
          {isWorker && (
            <>
              {t("admin.dashboard.worker_intro")} <strong>{t("admin.dashboard.worker_strong")}</strong>{" "}
              {t("admin.dashboard.worker_intro_end")}
            </>
          )}
        </p>
      </div>

      <Card className="max-w-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t("admin.dashboard.worker_role_card")}</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-semibold">{t("admin.dashboard.worker_role_value")}</div>
          <CardDescription className="mt-1">{t("admin.dashboard.worker_permissions")}</CardDescription>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
