import { Outlet, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  LogOut,
  ExternalLink,
  Mail,
  Users,
  Building2,
  Truck,
  Contact2,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useState } from "react";
import { cn } from "@/lib/utils";

const AdminLayout = () => {
  const { logout, user, isAdmin } = useAdminAuth();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navItems = [
    { to: "/admin", label: "Panel", icon: LayoutDashboard, roles: ["ADMIN", "WORKER"] as const },
    { to: "/admin/mensajes", label: isAdmin ? "Mensajes" : "Mis mensajes", icon: Mail, roles: ["ADMIN", "WORKER"] as const },
    { to: "/admin/usuarios", label: "Usuarios", icon: Users, roles: ["ADMIN"] as const },
    { to: "/admin/clientes", label: "Clientes", icon: Building2, roles: ["ADMIN"] as const },
    { to: "/admin/proveedores", label: "Proveedores", icon: Truck, roles: ["ADMIN"] as const },
    { to: "/admin/trabajadores", label: "Trabajadores", icon: Contact2, roles: ["ADMIN"] as const },
  ].filter((item) => user && item.roles.includes(user.role));

  const isNavActive = (path: string) =>
    path === "/admin"
      ? location.pathname === "/admin"
      : location.pathname.startsWith(path);

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {navItems.map((item) => {
        const active = isNavActive(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => mobile && setMobileNavOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isAdmin
                ? active
                  ? "bg-primary/20 text-primary border-l-2 border-primary -ml-px pl-[11px]"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white border-l-2 border-transparent"
                : active
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0 opacity-90" />
            {item.label}
          </Link>
        );
      })}
    </>
  );

  /* ——— Vista ADMIN: shell oscuro + área clara ——— */
  if (isAdmin && user) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row bg-slate-950">
        {/* Sidebar escritorio */}
        <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-slate-800/80 bg-slate-950">
          <div className="p-6 border-b border-slate-800/80">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Inorme</p>
            <p className="text-lg font-bold text-white tracking-tight mt-0.5">Administración</p>
            <p className="text-xs text-slate-400 mt-2 line-clamp-2">Panel de control corporativo</p>
          </div>
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            <NavLinks />
          </nav>
          <div className="p-4 border-t border-slate-800/80">
            <div className="rounded-lg bg-slate-900/80 p-3 text-xs text-slate-400">
              <p className="font-medium text-slate-200">{user.name}</p>
              <Badge className="mt-2 bg-primary/20 text-primary hover:bg-primary/25 border-0">
                Administrador
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
                aria-label="Menú"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <span className="text-sm font-medium text-muted-foreground truncate md:hidden">
                Inorme · Admin
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
                <a href="/" target="_blank" rel="noopener noreferrer" className="gap-1.5">
                  <ExternalLink className="h-4 w-4" />
                  Ver web pública
                </a>
              </Button>
              <Button variant="ghost" size="icon" className="sm:hidden" asChild>
                <a href="/" target="_blank" rel="noopener noreferrer" aria-label="Ver web">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="default" size="sm" onClick={logout} className="gap-1.5">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Cerrar sesión</span>
              </Button>
            </div>
          </header>

          {mobileNavOpen && (
            <>
              <button
                type="button"
                className="md:hidden fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm"
                aria-label="Cerrar menú"
                onClick={() => setMobileNavOpen(false)}
              />
              <div className="md:hidden fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] bg-slate-950 border-r border-slate-800 shadow-xl flex flex-col">
                <div className="p-5 border-b border-slate-800">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Inorme</p>
                  <p className="text-lg font-bold text-white">Administración</p>
                </div>
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                  <NavLinks mobile />
                </nav>
              </div>
            </>
          )}

          <main className="flex-1 p-4 lg:p-8 max-w-[1600px] w-full mx-auto">
            <Outlet />
          </main>
        </div>
      </div>
    );
  }

  /* ——— Vista TRABAJADOR: layout clásico ——— */
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 sticky top-0 z-10">
        <div className="flex h-14 items-center justify-between px-4 lg:px-6 max-w-7xl mx-auto w-full gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden shrink-0"
              onClick={() => setMobileNavOpen((o) => !o)}
              aria-label="Menú"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="font-semibold text-lg tracking-tight truncate">Backoffice</h1>
            {user && (
              <>
                <span className="text-muted-foreground text-sm hidden sm:inline truncate">
                  {user.name}
                </span>
                <Badge variant="secondary" className="shrink-0">
                  Trabajador
                </Badge>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" asChild>
              <a href="/" target="_blank" rel="noopener noreferrer" className="gap-1.5">
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">Ver web</span>
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={logout} className="gap-1.5">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Salir</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-7xl mx-auto w-full">
        <aside className="hidden md:flex w-56 shrink-0 border-r bg-muted/30 flex-col py-4">
          <nav className="px-2 space-y-1">
            {navItems.map((item) => (
              <Button
                key={item.to}
                variant={isNavActive(item.to) ? "secondary" : "ghost"}
                className="w-full justify-start gap-2"
                asChild
              >
                <Link to={item.to}>
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </Button>
            ))}
          </nav>
        </aside>

        {mobileNavOpen && (
          <div className="md:hidden fixed inset-0 z-20 bg-background/80 backdrop-blur-sm top-14">
            <nav className="p-4 flex flex-col gap-1 border-b bg-card">
              {navItems.map((item) => (
                <Button
                  key={item.to}
                  variant="ghost"
                  className="justify-start gap-2"
                  asChild
                  onClick={() => setMobileNavOpen(false)}
                >
                  <Link to={item.to}>
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </Button>
              ))}
            </nav>
          </div>
        )}

        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
