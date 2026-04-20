import { NavLink, Outlet } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const subNav = [
  { to: "/admin/grupo-legal", end: true, labelKey: "admin.legal.nav_dashboard" as const },
  { to: "/admin/grupo-legal/clientes", end: false, labelKey: "admin.legal.nav_clients" as const },
  { to: "/admin/grupo-legal/expedientes", end: false, labelKey: "admin.legal.nav_matters" as const },
  { to: "/admin/grupo-legal/facturas", end: false, labelKey: "admin.legal.nav_invoices" as const },
];

const LegalGrupoLayout = () => {
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("admin.legal.title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("admin.legal.subtitle")}</p>
      </div>
      <nav className="flex flex-wrap gap-2 border-b pb-2">
        {subNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            {t(item.labelKey)}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
};

export default LegalGrupoLayout;
