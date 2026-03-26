import { useMemo, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompanyWorkers } from "@/hooks/useCompanyWorkers";
import { publicAssetUrl } from "@/lib/publicAssetUrl";

/**
 * Landing del trabajador en /admin: vista mínima con logo, bienvenida y nombre/apellidos.
 */
export function WorkerDashboardWelcome() {
  const { user } = useAdminAuth();
  const { t } = useLanguage();
  const { data: workers = [], isLoading } = useCompanyWorkers();
  const [logoError, setLogoError] = useState(false);
  const logoSrc = publicAssetUrl("logo-inorme.png");

  const worker = useMemo(() => {
    if (!user?.companyWorkerId) return undefined;
    return workers.find((w) => w.id === user.companyWorkerId);
  }, [user?.companyWorkerId, workers]);

  const firstName = worker?.firstName?.trim() || "";
  const lastName = worker?.lastName?.trim() || "";

  return (
    <div className="flex min-h-[min(70vh,720px)] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="w-full max-w-md space-y-10">
        <div className="flex justify-center">
          {!logoError ? (
            <img
              src={logoSrc}
              alt="Inorme"
              className="h-14 w-auto object-contain dark:opacity-95"
              onError={() => setLogoError(true)}
            />
          ) : (
            <p className="text-2xl font-semibold tracking-tight text-foreground">Inorme</p>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t("admin.dashboard.worker_home_welcome")}
          </h1>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/30 px-6 py-8 text-left shadow-sm">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center">{t("admin.common.loading")}</p>
          ) : worker ? (
            <dl className="space-y-4">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("admin.dashboard.worker_home_first_name")}
                </dt>
                <dd className="mt-1 text-lg font-medium text-foreground">{firstName || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("admin.dashboard.worker_home_last_name")}
                </dt>
                <dd className="mt-1 text-lg font-medium text-foreground">{lastName || "—"}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground text-center">{t("admin.dashboard.worker_home_no_worker")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
