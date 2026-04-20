import { Outlet, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  LogOut,
  ExternalLink,
  Users,
  Building2,
  FolderKanban,
  CalendarDays,
  CalendarRange,
  Palmtree,
  Truck,
  Contact2,
  Menu,
  IdCard,
  Inbox,
  MessageSquare,
  UserPlus,
  ChevronDown,
  Clock3,
  FileText,
  Layers,
  Send,
  History,
  NotebookPen,
  Database,
  Euro,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Fragment, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { AdminDataNavHeading } from "@/components/admin/AdminDataNavHeading";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  useHasPendingWorkerRequest,
  usePendingWorkerProfileChangeRequests,
} from "@/hooks/useWorkerProfileChangeRequests";
import { usePendingWorkerVacationChangeRequests } from "@/hooks/useWorkerVacationChangeRequests";
import { usePendingWorkerExpenseSheets } from "@/hooks/useWorkerExpenseSheets";
import { useMyUnreadBackofficeMessageCount } from "@/hooks/useBackofficeMessages";
import { ADMIN_PATHS } from "@/constants/adminPaths";
import { IntranetAttentionDialogs } from "@/components/admin/IntranetAttentionDialogs";

const NAV_KEYS = [
  { to: "/admin", labelKey: "admin.layout.nav_panel", icon: LayoutDashboard, roles: ["ADMIN", "WORKER"] as const },
  { to: "/admin/vacaciones", labelKey: "admin.layout.nav_vacations", icon: Palmtree, roles: ["ADMIN"] as const },
  {
    to: ADMIN_PATHS.solicitudesVacaciones,
    labelKey: "admin.layout.nav_vacation_requests",
    icon: Inbox,
    roles: ["ADMIN"] as const,
  },
  { to: "/admin/mi-ficha", labelKey: "admin.layout.nav_my_profile", icon: IdCard, roles: ["WORKER", "ADMIN"] as const },
  {
    to: "/admin/mi-calendario",
    labelKey: "admin.layout.nav_my_calendar",
    icon: CalendarRange,
    roles: ["WORKER", "ADMIN"] as const,
    requiredModule: "VACATIONS" as const,
  },
  {
    to: "/admin/mi-agenda",
    labelKey: "admin.layout.nav_my_agenda",
    icon: NotebookPen,
    roles: ["WORKER", "ADMIN"] as const,
    requiredModule: "AGENDA" as const,
  },
  {
    to: "/admin/mis-gastos",
    labelKey: "admin.layout.nav_my_expenses",
    icon: Euro,
    roles: ["WORKER", "ADMIN"] as const,
    requiredModule: "GASTOS" as const,
  },
  {
    to: "/admin/facturacion",
    labelKey: "admin.layout.nav_billing",
    icon: FileText,
    roles: ["WORKER", "ADMIN"] as const,
  },
  {
    to: "/admin/mensajes",
    labelKey: "admin.layout.nav_messages",
    icon: Inbox,
    roles: ["WORKER", "ADMIN"] as const,
    requiredModule: "MESSAGES" as const,
  },
  {
    to: "/admin/mensajes-trabajadores",
    labelKey: "admin.layout.nav_worker_messages_admin",
    icon: MessageSquare,
    roles: ["ADMIN"] as const,
  },
  {
    to: "/admin/agendas-trabajadores",
    labelKey: "admin.layout.nav_worker_agendas_admin",
    icon: NotebookPen,
    roles: ["ADMIN"] as const,
  },
  {
    to: ADMIN_PATHS.gastosTrabajadores,
    labelKey: "admin.layout.nav_worker_expenses_admin",
    icon: Euro,
    roles: ["ADMIN"] as const,
  },
  {
    to: "/admin/control-fichajes",
    labelKey: "admin.layout.nav_time_clock_admin",
    icon: Clock3,
    roles: ["ADMIN"] as const,
  },
  {
    to: "/admin/control-fichajes/informes",
    labelKey: "admin.layout.nav_time_clock_reports",
    icon: FileText,
    roles: ["ADMIN"] as const,
  },
  {
    to: ADMIN_PATHS.solicitudesFichajes,
    labelKey: "admin.layout.nav_time_clock_requests",
    icon: Inbox,
    roles: ["ADMIN"] as const,
  },
  {
    to: ADMIN_PATHS.solicitudesFicha,
    labelKey: "admin.layout.nav_profile_requests",
    icon: Inbox,
    roles: ["ADMIN"] as const,
  },
  { to: "/admin/usuarios", labelKey: "admin.layout.nav_users_list", icon: Users, roles: ["ADMIN"] as const },
  {
    to: "/admin/usuarios/alta-masiva",
    labelKey: "admin.layout.nav_users_bulk",
    icon: UserPlus,
    roles: ["ADMIN"] as const,
  },
  {
    to: "/admin/usuarios/activacion-modulos",
    labelKey: "admin.layout.nav_users_module_activation",
    icon: Layers,
    roles: ["ADMIN"] as const,
  },
  { to: "/admin/trabajadores", labelKey: "admin.layout.nav_workers", icon: Contact2, roles: ["ADMIN"] as const },
  { to: "/admin/proveedores", labelKey: "admin.layout.nav_providers", icon: Truck, roles: ["ADMIN"] as const },
  { to: "/admin/clientes", labelKey: "admin.layout.nav_clients", icon: Building2, roles: ["ADMIN"] as const },
  { to: "/admin/proyectos", labelKey: "admin.layout.nav_projects", icon: FolderKanban, roles: ["ADMIN"] as const },
  { to: "/admin/calendarios-laborales", labelKey: "admin.layout.nav_calendars", icon: CalendarDays, roles: ["ADMIN"] as const },
] as const;

const ADMIN_MESSAGE_CHILD_ROUTES = [
  ADMIN_PATHS.solicitudesVacaciones,
  ADMIN_PATHS.solicitudesFicha,
  ADMIN_PATHS.mensajesTrabajadores,
  ADMIN_PATHS.solicitudesFichajes,
] as const;

const USERS_SECTION_ROUTES = [
  "/admin/usuarios",
  "/admin/usuarios/alta-masiva",
  "/admin/usuarios/activacion-modulos",
] as const;
const TIME_CLOCK_SECTION_ROUTES = ["/admin/control-fichajes", "/admin/control-fichajes/informes"] as const;
/** Rutas «personales» del admin (agrupadas bajo «{nombre} DATA»). */
const ADMIN_SELF_SERVICE_PATHS = [
  "/admin/mi-ficha",
  "/admin/mi-calendario",
  "/admin/mi-agenda",
  "/admin/mis-gastos",
  "/admin/facturacion",
  "/admin/mensajes",
] as const;
/** Submenú solo bajo «Fichajes» (no van en NAV_KEYS para no duplicar enlaces de primer nivel). */
const WORKER_TIME_CLOCK_NAV_SUBITEMS = [
  { to: "/admin/fichajes/fichar", labelKey: "admin.layout.nav_worker_time_clock_fichar", icon: Clock3 },
  { to: "/admin/fichajes/correccion", labelKey: "admin.layout.nav_worker_time_clock_correction", icon: Send },
  { to: "/admin/fichajes/historial", labelKey: "admin.layout.nav_worker_time_clock_history", icon: History },
] as const;

function normalizeRole(value: unknown): "ADMIN" | "WORKER" | null {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (raw === "ADMIN") return "ADMIN";
  if (raw === "WORKER") return "WORKER";
  return null;
}

const AdminLayout = () => {
  const { logout, user, isAdmin } = useAdminAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const supabaseOk = isSupabaseConfigured();
  const { data: pendingProfileRequests = [] } = usePendingWorkerProfileChangeRequests(
    isAdmin && supabaseOk && !!user
  );
  const pendingAdminProfileCount = pendingProfileRequests.length;
  const userRole = normalizeRole(user?.role);
  const enabledModules = user?.enabledModules ?? [];
  const workerEnabledModules = userRole === "WORKER" ? enabledModules : [];
  const { data: workerHasPendingProfileRequest = false } = useHasPendingWorkerRequest(
    userRole === "WORKER" || userRole === "ADMIN" ? user?.companyWorkerId ?? null : null
  );
  const { data: unreadMessageCount = 0 } = useMyUnreadBackofficeMessageCount(
    supabaseOk &&
      !!user &&
      (userRole === "WORKER" || userRole === "ADMIN") &&
      enabledModules.includes("MESSAGES")
  );
  const { data: pendingVacationRequests = [] } = usePendingWorkerVacationChangeRequests(
    isAdmin && supabaseOk && !!user
  );
  const pendingVacationRequestCount = pendingVacationRequests.length;
  const { data: pendingExpenseSheets = [] } = usePendingWorkerExpenseSheets(
    isAdmin && supabaseOk && !!user
  );
  const pendingExpenseSheetCount = pendingExpenseSheets.length;
  const pendingAdminMessagesCount = pendingAdminProfileCount + pendingVacationRequestCount;

  const navItems = NAV_KEYS.filter((item) => {
    if (userRole === null || !item.roles.includes(userRole)) return false;
    if ("requiredModule" in item && item.requiredModule) {
      return enabledModules.includes(item.requiredModule);
    }
    return true;
  });

  const adminSelfServiceItems = navItems.filter((item) =>
    (ADMIN_SELF_SERVICE_PATHS as readonly string[]).includes(item.to)
  );
  const adminHasPersonalTimeClock = isAdmin && enabledModules.includes("TIME_CLOCK");
  const showAdminDataNav =
    isAdmin && (adminSelfServiceItems.length > 0 || adminHasPersonalTimeClock);

  const isAdminDataSectionActive =
    isAdmin &&
    (location.pathname === "/admin/mi-ficha" ||
      location.pathname === "/admin/mi-calendario" ||
      location.pathname === "/admin/mi-agenda" ||
      location.pathname === "/admin/mis-gastos" ||
      location.pathname === "/admin/mensajes" ||
      location.pathname.startsWith("/admin/fichajes"));

  const [adminDataSectionOpen, setAdminDataSectionOpen] = useState(isAdminDataSectionActive);
  useEffect(() => {
    if (isAdminDataSectionActive) setAdminDataSectionOpen(true);
  }, [isAdminDataSectionActive]);

  const isAdminDataFichajeSectionActive =
    isAdmin && location.pathname.startsWith("/admin/fichajes");
  const [adminDataFichajeOpen, setAdminDataFichajeOpen] = useState(isAdminDataFichajeSectionActive);
  useEffect(() => {
    if (isAdminDataFichajeSectionActive) setAdminDataFichajeOpen(true);
  }, [isAdminDataFichajeSectionActive]);
  const adminMessageItems = navItems.filter((item) =>
    ADMIN_MESSAGE_CHILD_ROUTES.includes(item.to as (typeof ADMIN_MESSAGE_CHILD_ROUTES)[number])
  );
  const usersNavItems = navItems.filter((item) =>
    USERS_SECTION_ROUTES.includes(item.to as (typeof USERS_SECTION_ROUTES)[number])
  );
  const timeClockNavItems = navItems.filter((item) =>
    TIME_CLOCK_SECTION_ROUTES.includes(item.to as (typeof TIME_CLOCK_SECTION_ROUTES)[number])
  );
  const workerHasTimeClockModule = userRole === "WORKER" && enabledModules.includes("TIME_CLOCK");
  const navItemsWithoutAdminMessages = navItems.filter(
    (item) =>
      !ADMIN_MESSAGE_CHILD_ROUTES.includes(item.to as (typeof ADMIN_MESSAGE_CHILD_ROUTES)[number]) &&
      !USERS_SECTION_ROUTES.includes(item.to as (typeof USERS_SECTION_ROUTES)[number]) &&
      !TIME_CLOCK_SECTION_ROUTES.includes(item.to as (typeof TIME_CLOCK_SECTION_ROUTES)[number]) &&
      !(isAdmin && (ADMIN_SELF_SERVICE_PATHS as readonly string[]).includes(item.to))
  );
  const isAdminMessagesSectionActive = ADMIN_MESSAGE_CHILD_ROUTES.some(
    (path) => location.pathname === path || location.pathname.startsWith(`${path}/`)
  );
  const [adminMessagesOpen, setAdminMessagesOpen] = useState(isAdminMessagesSectionActive);

  useEffect(() => {
    if (isAdminMessagesSectionActive) setAdminMessagesOpen(true);
  }, [isAdminMessagesSectionActive]);

  const isUsersSectionActive = location.pathname.startsWith("/admin/usuarios");
  const [usersSectionOpen, setUsersSectionOpen] = useState(isUsersSectionActive);

  useEffect(() => {
    if (isUsersSectionActive) setUsersSectionOpen(true);
  }, [isUsersSectionActive]);

  const isTimeClockSectionActive = location.pathname.startsWith("/admin/control-fichajes");
  const [timeClockSectionOpen, setTimeClockSectionOpen] = useState(isTimeClockSectionActive);

  useEffect(() => {
    if (isTimeClockSectionActive) setTimeClockSectionOpen(true);
  }, [isTimeClockSectionActive]);

  const isWorkerTimeClockSectionActive = location.pathname.startsWith("/admin/fichajes");
  const [workerTimeClockSectionOpen, setWorkerTimeClockSectionOpen] = useState(isWorkerTimeClockSectionActive);

  useEffect(() => {
    if (isWorkerTimeClockSectionActive) setWorkerTimeClockSectionOpen(true);
  }, [isWorkerTimeClockSectionActive]);

  const navNeedsAttention = (to: string) => {
    if (to === ADMIN_PATHS.solicitudesFicha && userRole === "ADMIN") return pendingAdminProfileCount > 0;
    if (to === ADMIN_PATHS.solicitudesVacaciones && userRole === "ADMIN")
      return pendingVacationRequestCount > 0;
    if (to === ADMIN_PATHS.gastosTrabajadores && userRole === "ADMIN") return pendingExpenseSheetCount > 0;
    if (to === "/admin/mensajes" && (userRole === "WORKER" || userRole === "ADMIN"))
      return unreadMessageCount > 0;
    if (to === "/admin/mi-ficha" && (userRole === "WORKER" || userRole === "ADMIN"))
      return workerHasPendingProfileRequest;
    return false;
  };

  /** Pantalla obligatoria de nueva contraseña: sin menú lateral para evitar eludir la política. */
  if (user && location.pathname === "/admin/cambiar-contrasena") {
    return (
      <div className="min-h-screen bg-muted/40 flex flex-col">
        <header className="border-b bg-card px-4 py-3 flex justify-between items-center gap-2 shrink-0">
          <span className="font-semibold text-sm truncate">{t("admin.passwordChange.header_title")}</span>
          <Button variant="outline" size="sm" onClick={logout} className="gap-1.5 shrink-0">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">{t("admin.layout.logout")}</span>
            <span className="sm:hidden">{t("admin.layout.logout_short")}</span>
          </Button>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <Outlet />
        </main>
      </div>
    );
  }

  const isNavActive = (path: string) => {
    const { pathname } = location;
    if (path === "/admin") return pathname === "/admin";
    /** Evita marcar «Usuarios» activo en rutas hijas como alta masiva. */
    if (path === "/admin/usuarios") return pathname === "/admin/usuarios";
    /** Evita marcar «Control de fichajes» activo en «Informes fichajes». */
    if (path === "/admin/control-fichajes") return pathname === "/admin/control-fichajes";
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const NavLinks = ({
    mobile = false,
    vacationNotifyCount: vacCount = 0,
    expensePendingCount = 0,
  }: {
    mobile?: boolean;
    vacationNotifyCount?: number;
    expensePendingCount?: number;
  }) => (
    <>
      {navItemsWithoutAdminMessages.map((item) => {
        const active = isNavActive(item.to);
        const attention = navNeedsAttention(item.to);
        const pendingLabel =
          item.to === ADMIN_PATHS.solicitudesFicha && pendingAdminProfileCount > 0
            ? t("admin.layout.nav_pending_profile_requests_aria").replace(
                "{{count}}",
                String(pendingAdminProfileCount)
              )
            : attention && item.to === "/admin/mi-ficha"
              ? t("admin.layout.nav_my_profile_pending_aria")
              : attention && item.to === "/admin/mensajes"
                ? t("admin.layout.nav_messages_pending_aria").replace("{{count}}", String(unreadMessageCount))
                : attention && item.to === ADMIN_PATHS.solicitudesVacaciones && vacCount > 0
                  ? t("admin.layout.nav_vacation_requests_pending_aria").replace("{{count}}", String(vacCount))
                  : attention && item.to === ADMIN_PATHS.gastosTrabajadores && expensePendingCount > 0
                    ? t("admin.layout.nav_expenses_pending_aria").replace(
                        "{{count}}",
                        String(expensePendingCount)
                      )
                    : undefined;
        return (
          <Fragment key={item.to}>
            <Link
              to={item.to}
              onClick={() => mobile && setMobileNavOpen(false)}
              aria-label={pendingLabel}
              title={pendingLabel}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors w-full",
                active ? "font-bold" : attention ? "font-semibold" : "font-medium",
                isAdmin
                  ? active
                    ? attention
                      ? "bg-red-950/50 text-red-400 border-l-2 border-red-500 -ml-px pl-[11px]"
                      : "bg-primary/20 text-primary border-l-2 border-primary -ml-px pl-[11px] font-bold"
                    : attention
                      ? "text-red-400 border-l-2 border-transparent hover:bg-slate-800 hover:text-red-300"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white border-l-2 border-transparent"
                  : active
                    ? attention
                      ? "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 font-bold"
                      : "bg-secondary text-secondary-foreground font-bold"
                    : attention
                      ? "text-red-600 dark:text-red-400 font-bold hover:bg-muted hover:text-red-700 dark:hover:text-red-300"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-3 min-w-0">
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0 opacity-90",
                    attention && isAdmin && "text-red-400 opacity-100",
                    attention && !isAdmin && "text-red-600 dark:text-red-400 opacity-100"
                  )}
                />
                <span className="truncate">{t(item.labelKey)}</span>
              </span>
              {item.to === ADMIN_PATHS.solicitudesVacaciones && vacCount > 0 ? (
                <Badge
                  variant="secondary"
                  className="shrink-0 h-5 min-w-[1.25rem] px-1.5 text-[10px] font-semibold tabular-nums bg-primary/25 text-primary border-0"
                >
                  {vacCount > 99 ? "99+" : vacCount}
                </Badge>
              ) : item.to === ADMIN_PATHS.gastosTrabajadores && expensePendingCount > 0 ? (
                <Badge
                  variant="secondary"
                  className="shrink-0 h-5 min-w-[1.25rem] px-1.5 text-[10px] font-semibold tabular-nums bg-primary/25 text-primary border-0"
                >
                  {expensePendingCount > 99 ? "99+" : expensePendingCount}
                </Badge>
              ) : null}
            </Link>
            {/* Tras «Vacaciones» (resumen admin): «solicitudes-vacaciones» no está en esta lista (va al hub Mensajes). */}
            {item.to === "/admin/vacaciones" && showAdminDataNav ? (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setAdminDataSectionOpen((v) => !v)}
                  aria-expanded={adminDataSectionOpen}
                  aria-controls="admin-data-submenu"
                  id="admin-data-menu-button"
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg border-l-2 px-3 py-2.5 text-sm transition-colors",
                    isAdminDataSectionActive
                      ? "-ml-px border-primary bg-primary/20 pl-[11px] font-bold text-primary"
                      : "border-transparent font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Database className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    {user ? <AdminDataNavHeading user={user} /> : <span className="truncate">— DATA</span>}
                  </span>
                  <ChevronDown
                    className={cn("h-4 w-4 shrink-0 transition-transform", adminDataSectionOpen && "rotate-180")}
                    aria-hidden
                  />
                </button>
                {adminDataSectionOpen ? (
                  <div
                    id="admin-data-submenu"
                    role="region"
                    aria-labelledby="admin-data-menu-button"
                    className="space-y-1 pl-8"
                  >
                    {adminSelfServiceItems.map((subItem) => {
                      const subActive = isNavActive(subItem.to);
                      const subAttention = navNeedsAttention(subItem.to);
                      const SubIcon = subItem.icon;
                      return (
                        <Link
                          key={subItem.to}
                          to={subItem.to}
                          onClick={() => mobile && setMobileNavOpen(false)}
                          className={cn(
                            "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors w-full",
                            subActive
                              ? "bg-primary/20 font-bold text-primary"
                              : subAttention
                                ? "font-semibold text-red-400 hover:bg-slate-800"
                                : "text-slate-300 hover:bg-slate-800 hover:text-white"
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <SubIcon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                            <span className="truncate">{t(subItem.labelKey)}</span>
                          </span>
                        </Link>
                      );
                    })}
                    {adminHasPersonalTimeClock ? (
                      <div className="space-y-0.5">
                        <button
                          type="button"
                          id="admin-data-fichaje-button"
                          onClick={() => setAdminDataFichajeOpen((v) => !v)}
                          aria-expanded={adminDataFichajeOpen}
                          aria-controls="admin-data-fichaje-submenu"
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                            isAdminDataFichajeSectionActive
                              ? "bg-primary/20 font-bold text-primary"
                              : "font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <Clock3 className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                            <span className="truncate">{t("admin.layout.nav_admin_data_fichaje")}</span>
                          </span>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 shrink-0 transition-transform opacity-80",
                              adminDataFichajeOpen && "rotate-180"
                            )}
                            aria-hidden
                          />
                        </button>
                        {adminDataFichajeOpen ? (
                          <div
                            id="admin-data-fichaje-submenu"
                            role="region"
                            aria-labelledby="admin-data-fichaje-button"
                            className="ml-1 space-y-0.5 border-l-2 border-slate-600/60 pl-3"
                          >
                            {WORKER_TIME_CLOCK_NAV_SUBITEMS.map((sub) => {
                              const SubIcon = sub.icon;
                              const subActive = isNavActive(sub.to);
                              return (
                                <Link
                                  key={sub.to}
                                  to={sub.to}
                                  onClick={() => mobile && setMobileNavOpen(false)}
                                  className={cn(
                                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                                    subActive
                                      ? "bg-primary/15 font-semibold text-primary"
                                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                  )}
                                >
                                  <SubIcon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                                  <span className="truncate">{t(sub.labelKey)}</span>
                                </Link>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            {item.to === "/admin/vacaciones" && isAdmin && usersNavItems.length > 0 ? (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setUsersSectionOpen((v) => !v)}
                  aria-expanded={usersSectionOpen}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors w-full border-l-2",
                    isUsersSectionActive
                      ? "font-bold text-primary bg-primary/20 border-primary -ml-px pl-[11px]"
                      : "font-medium text-slate-300 hover:bg-slate-800 hover:text-white border-transparent"
                  )}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Users className="h-4 w-4 shrink-0 opacity-90" />
                    <span className="truncate">{t("admin.layout.nav_users")}</span>
                  </span>
                  <ChevronDown
                    className={cn("h-4 w-4 shrink-0 transition-transform", usersSectionOpen && "rotate-180")}
                  />
                </button>
                {usersSectionOpen ? (
                  <div className="space-y-1 pl-8">
                    {usersNavItems.map((sub) => {
                      const subActive = isNavActive(sub.to);
                      return (
                        <Link
                          key={sub.to}
                          to={sub.to}
                          onClick={() => mobile && setMobileNavOpen(false)}
                          className={cn(
                            "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors w-full",
                            subActive
                              ? "bg-primary/20 text-primary font-bold"
                              : "text-slate-300 hover:bg-slate-800 hover:text-white"
                          )}
                        >
                          <span className="truncate">{t(sub.labelKey)}</span>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
            {item.to === "/admin/control-fichajes" && isAdmin && timeClockNavItems.length > 0 ? (
              null
            ) : null}
          </Fragment>
        );
      })}
      {workerHasTimeClockModule ? (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setWorkerTimeClockSectionOpen((v) => !v)}
            aria-expanded={workerTimeClockSectionOpen}
            aria-controls="worker-fichajes-submenu"
            id="worker-fichajes-menu-button"
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-lg border-l-2 px-3 py-2.5 text-sm transition-colors",
              isWorkerTimeClockSectionActive
                ? "border-secondary -ml-px bg-secondary pl-[11px] font-bold text-secondary-foreground"
                : "border-transparent font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <span className="flex min-w-0 items-center gap-3">
              <Clock3 className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              <span className="truncate">{t("admin.layout.nav_time_clock_worker")}</span>
            </span>
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 transition-transform", workerTimeClockSectionOpen && "rotate-180")}
              aria-hidden
            />
          </button>
          {workerTimeClockSectionOpen ? (
            <div
              id="worker-fichajes-submenu"
              role="region"
              aria-labelledby="worker-fichajes-menu-button"
              className="ml-1 space-y-0.5 border-l-2 border-muted-foreground/25 pl-3"
            >
              {WORKER_TIME_CLOCK_NAV_SUBITEMS.map((sub) => {
                const SubIcon = sub.icon;
                const subActive = isNavActive(sub.to);
                return (
                  <Link
                    key={sub.to}
                    to={sub.to}
                    onClick={() => mobile && setMobileNavOpen(false)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                      subActive
                        ? "bg-secondary font-semibold text-secondary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <SubIcon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                    <span className="truncate">{t(sub.labelKey)}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
      {isAdmin && timeClockNavItems.length > 0 ? (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setTimeClockSectionOpen((v) => !v)}
            aria-expanded={timeClockSectionOpen}
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors w-full border-l-2",
              isTimeClockSectionActive
                ? "font-bold text-primary bg-primary/20 border-primary -ml-px pl-[11px]"
                : "font-medium text-slate-300 hover:bg-slate-800 hover:text-white border-transparent"
            )}
          >
            <span className="flex items-center gap-3 min-w-0">
              <Clock3 className="h-4 w-4 shrink-0 opacity-90" />
              <span className="truncate">{t("admin.layout.nav_time_clock_hub")}</span>
            </span>
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 transition-transform", timeClockSectionOpen && "rotate-180")}
            />
          </button>
          {timeClockSectionOpen ? (
            <div className="space-y-1 pl-8">
              {timeClockNavItems.map((sub) => {
                const subActive = isNavActive(sub.to);
                return (
                  <Link
                    key={sub.to}
                    to={sub.to}
                    onClick={() => mobile && setMobileNavOpen(false)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors w-full",
                      subActive
                        ? "bg-primary/20 text-primary font-bold"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    <span className="truncate">{t(sub.labelKey)}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
      {isAdmin && adminMessageItems.length > 0 ? (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setAdminMessagesOpen((v) => !v)}
            aria-label={
              pendingAdminMessagesCount > 0
                ? t("admin.layout.nav_messages_hub_pending_aria").replace(
                    "{{count}}",
                    String(pendingAdminMessagesCount)
                  )
                : undefined
            }
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors w-full",
              isAdminMessagesSectionActive && "font-bold bg-primary/20 text-primary border-l-2 border-primary -ml-px pl-[11px]",
              pendingAdminMessagesCount > 0
                ? "font-bold text-red-400 border-l-2 border-transparent hover:bg-slate-800 hover:text-red-300"
                : "font-medium text-slate-300 hover:bg-slate-800 hover:text-white border-l-2 border-transparent"
            )}
          >
            <span className="flex items-center gap-3 min-w-0">
              <Inbox
                className={cn(
                  "h-4 w-4 shrink-0 opacity-90",
                  pendingAdminMessagesCount > 0 && "text-red-400 opacity-100"
                )}
              />
              <span className="truncate">{t("admin.layout.nav_messages_hub")}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              {pendingAdminMessagesCount > 0 ? (
                <Badge
                  variant="secondary"
                  className="shrink-0 h-5 min-w-[1.25rem] px-1.5 text-[10px] font-semibold tabular-nums bg-primary/25 text-primary border-0"
                >
                  {pendingAdminMessagesCount > 99 ? "99+" : pendingAdminMessagesCount}
                </Badge>
              ) : null}
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 transition-transform", adminMessagesOpen && "rotate-180")}
              />
            </span>
          </button>
          {adminMessagesOpen ? (
            <div className="space-y-1 pl-8">
              {adminMessageItems.map((item) => {
                const active = isNavActive(item.to);
                const attention = navNeedsAttention(item.to);
                const childCount =
                  item.to === ADMIN_PATHS.solicitudesVacaciones
                    ? pendingVacationRequestCount
                    : item.to === ADMIN_PATHS.solicitudesFicha
                      ? pendingAdminProfileCount
                      : 0;
                const pendingLabel =
                  item.to === ADMIN_PATHS.solicitudesFicha && pendingAdminProfileCount > 0
                    ? t("admin.layout.nav_pending_profile_requests_aria").replace(
                        "{{count}}",
                        String(pendingAdminProfileCount)
                      )
                    : item.to === ADMIN_PATHS.solicitudesVacaciones && pendingVacationRequestCount > 0
                      ? t("admin.layout.nav_vacation_requests_pending_aria").replace(
                          "{{count}}",
                          String(pendingVacationRequestCount)
                        )
                      : undefined;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => mobile && setMobileNavOpen(false)}
                    aria-label={pendingLabel}
                    title={pendingLabel}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors w-full",
                      active
                        ? attention
                          ? "bg-red-950/50 text-red-400 font-bold"
                          : "bg-primary/20 text-primary font-bold"
                        : attention
                          ? "text-red-400 hover:bg-slate-800 hover:text-red-300"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    <span className="truncate">{t(item.labelKey)}</span>
                    {childCount > 0 ? (
                      <Badge
                        variant="secondary"
                        className="shrink-0 h-5 min-w-[1.25rem] px-1.5 text-[10px] font-semibold tabular-nums bg-primary/25 text-primary border-0"
                      >
                        {childCount > 99 ? "99+" : childCount}
                      </Badge>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );

  /* ——— Vista ADMIN: shell oscuro + área clara ——— */
  if (isAdmin && user) {
    return (
      <>
        <IntranetAttentionDialogs />
      <div className="min-h-screen flex flex-col md:flex-row bg-slate-950">
        {/* Sidebar escritorio */}
        <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-slate-800/80 bg-slate-950">
          <div className="p-6 border-b border-slate-800/80">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{t("admin.layout.brand")}</p>
            <p className="text-lg font-bold text-white tracking-tight mt-0.5">{t("admin.layout.admin_title")}</p>
            <p className="text-xs text-slate-400 mt-2 line-clamp-2">{t("admin.layout.admin_subtitle")}</p>
          </div>
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            <NavLinks
              vacationNotifyCount={pendingVacationRequestCount}
              expensePendingCount={pendingExpenseSheetCount}
            />
          </nav>
          <div className="p-4 border-t border-slate-800/80">
            <div className="rounded-lg bg-slate-900/80 p-3 text-xs text-slate-400">
              <p className="font-medium text-slate-200">{user.name}</p>
              <Badge className="mt-2 bg-primary/20 text-primary hover:bg-primary/25 border-0">
                {t("admin.layout.badge_admin")}
              </Badge>
            </div>
          </div>
        </aside>

        {/* Contenido principal */}
        <div className="flex-1 flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950/50">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 px-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800 dark:bg-slate-900/95">
            <div className="flex items-center gap-2 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden shrink-0 -ml-1"
                onClick={() => setMobileNavOpen((o) => !o)}
                aria-label={t("admin.layout.menu")}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <span className="text-sm font-medium text-muted-foreground truncate md:hidden">
                {t("admin.layout.mobile_title")}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center mr-1">
                <LanguageSwitcher variant="dark" />
              </div>
              <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
                <a href="/" target="_blank" rel="noopener noreferrer" className="gap-1.5">
                  <ExternalLink className="h-4 w-4" />
                  {t("admin.layout.view_public")}
                </a>
              </Button>
              <Button variant="ghost" size="icon" className="sm:hidden" asChild>
                <a href="/" target="_blank" rel="noopener noreferrer" aria-label={t("admin.layout.view_public_short")}>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="default" size="sm" onClick={logout} className="gap-1.5">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">{t("admin.layout.logout")}</span>
              </Button>
            </div>
          </header>

          {mobileNavOpen && (
            <>
              <button
                type="button"
                className="md:hidden fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm"
                aria-label={t("admin.layout.close_menu")}
                onClick={() => setMobileNavOpen(false)}
              />
              <div className="md:hidden fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] bg-slate-950 border-r border-slate-800 shadow-xl flex flex-col">
                <div className="p-5 border-b border-slate-800">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{t("admin.layout.brand")}</p>
                  <p className="text-lg font-bold text-white">{t("admin.layout.admin_title")}</p>
                </div>
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                  <NavLinks
                  mobile
                  vacationNotifyCount={pendingVacationRequestCount}
                  expensePendingCount={pendingExpenseSheetCount}
                />
                </nav>
              </div>
            </>
          )}

          <main className="flex-1 p-4 lg:p-8 max-w-[1600px] w-full mx-auto">
            <Outlet />
          </main>
        </div>
      </div>
      </>
    );
  }

  /* ——— Vista TRABAJADOR: layout clásico ——— */
  return (
    <>
      <IntranetAttentionDialogs />
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 sticky top-0 z-10">
        <div className="flex h-14 items-center justify-between px-4 lg:px-6 max-w-7xl mx-auto w-full gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden shrink-0"
              onClick={() => setMobileNavOpen((o) => !o)}
              aria-label={t("admin.layout.menu")}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="font-semibold text-lg tracking-tight truncate">{t("admin.common.backoffice")}</h1>
            {user && (
              <>
                <span className="text-muted-foreground text-sm hidden sm:inline truncate">
                  {user.name}
                </span>
                <Badge variant="secondary" className="shrink-0">
                  {t("admin.layout.badge_worker")}
                </Badge>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitcher variant="dark" />
            <Button variant="ghost" size="sm" asChild>
              <a href="/" target="_blank" rel="noopener noreferrer" className="gap-1.5">
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">{t("admin.layout.view_public_short")}</span>
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={logout} className="gap-1.5">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{t("admin.layout.logout_short")}</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-7xl mx-auto w-full">
        <aside className="hidden md:flex w-56 shrink-0 border-r bg-muted/30 flex-col py-4">
          <nav className="px-2 space-y-1">
            <NavLinks
              vacationNotifyCount={pendingVacationRequestCount}
              expensePendingCount={pendingExpenseSheetCount}
            />
          </nav>
        </aside>

        {mobileNavOpen && (
          <div className="md:hidden fixed inset-0 z-20 bg-background/80 backdrop-blur-sm top-14">
            <nav className="flex max-h-[calc(100vh-3.5rem)] flex-col gap-1 overflow-y-auto border-b bg-card p-4">
              <NavLinks
                  mobile
                  vacationNotifyCount={pendingVacationRequestCount}
                  expensePendingCount={pendingExpenseSheetCount}
                />
            </nav>
          </div>
        )}

        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
    </>
  );
};

export default AdminLayout;
