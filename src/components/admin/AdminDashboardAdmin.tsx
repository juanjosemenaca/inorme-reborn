import { Link } from "react-router-dom";
import {
  Users2,
  Building2,
  FolderKanban,
  Truck,
  Contact2,
  ArrowRight,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useBackofficeUsers } from "@/hooks/useBackofficeUsers";
import { useClients } from "@/hooks/useClients";
import { useProviders } from "@/hooks/useProviders";
import { useCompanyWorkers } from "@/hooks/useCompanyWorkers";
import { useProjects } from "@/hooks/useProjects";
import { useLanguage } from "@/contexts/LanguageContext";
import type { BackofficeSession } from "@/types/backoffice";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const chartData = [
  { mes: "Sep", contactos: 12 },
  { mes: "Oct", contactos: 19 },
  { mes: "Nov", contactos: 15 },
  { mes: "Dic", contactos: 22 },
  { mes: "Ene", contactos: 18 },
  { mes: "Feb", contactos: 24 },
];

type Props = {
  session: BackofficeSession;
};

export function AdminDashboardAdmin({ session }: Props) {
  const { t, language } = useLanguage();
  const allUsers = useBackofficeUsers();
  const allClients = useClients();
  const allProviders = useProviders();
  const allCompanyWorkers = useCompanyWorkers();
  const { data: allProjects = [] } = useProjects();
  const userCount = allUsers.length;
  const clientCount = allClients.length;
  const projectCount = allProjects.length;
  const providerCount = allProviders.length;
  const workerCount = allCompanyWorkers.length;

  const dateLocale = language === "ca" ? "ca-ES" : language === "en" ? "en-GB" : "es-ES";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{t("admin.dashboard.admin_control")}</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t("admin.dashboard.admin_hello")} {session.name.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-xl">{t("admin.dashboard.admin_subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {new Date().toLocaleDateString(dateLocale, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("admin.dashboard.kpi_users")}
            </CardTitle>
            <div className="rounded-lg bg-muted p-2">
              <Users2 className="h-4 w-4 text-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{userCount}</div>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link to="/admin/usuarios">{t("admin.dashboard.link_users")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("admin.dashboard.kpi_clients")}
            </CardTitle>
            <div className="rounded-lg bg-muted p-2">
              <Building2 className="h-4 w-4 text-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{clientCount}</div>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link to="/admin/clientes">{t("admin.dashboard.link_clients")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("admin.dashboard.kpi_projects")}
            </CardTitle>
            <div className="rounded-lg bg-muted p-2">
              <FolderKanban className="h-4 w-4 text-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{projectCount}</div>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link to="/admin/proyectos">{t("admin.dashboard.link_projects")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("admin.dashboard.kpi_providers")}
            </CardTitle>
            <div className="rounded-lg bg-muted p-2">
              <Truck className="h-4 w-4 text-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{providerCount}</div>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link to="/admin/proveedores">{t("admin.dashboard.link_providers")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("admin.dashboard.kpi_workers")}
            </CardTitle>
            <div className="rounded-lg bg-muted p-2">
              <Contact2 className="h-4 w-4 text-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{workerCount}</div>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link to="/admin/trabajadores">{t("admin.dashboard.link_workers")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">{t("admin.common.chart_demo")}</CardTitle>
            <CardDescription>{t("admin.common.chart_demo_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} width={32} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Bar dataKey="contactos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("admin.common.quick_links")}</CardTitle>
            <CardDescription>{t("admin.common.quick_links_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button variant="outline" className="justify-between h-auto py-3" asChild>
              <Link to="/admin/usuarios">
                <span className="flex items-center gap-2">
                  <Users2 className="h-4 w-4 text-primary" />
                  {t("admin.dashboard.link_users_roles")}
                </span>
                <ArrowRight className="h-4 w-4 opacity-50" />
              </Link>
            </Button>
            <Button variant="outline" className="justify-between h-auto py-3" asChild>
              <Link to="/admin/clientes">
                <span className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  {t("admin.dashboard.link_clients_contacts")}
                </span>
                <ArrowRight className="h-4 w-4 opacity-50" />
              </Link>
            </Button>
            <Button variant="outline" className="justify-between h-auto py-3" asChild>
              <Link to="/admin/proyectos">
                <span className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-primary" />
                  {t("admin.dashboard.link_projects")}
                </span>
                <ArrowRight className="h-4 w-4 opacity-50" />
              </Link>
            </Button>
            <Button variant="outline" className="justify-between h-auto py-3" asChild>
              <Link to="/admin/proveedores">
                <span className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary" />
                  {t("admin.dashboard.kpi_providers")}
                </span>
                <ArrowRight className="h-4 w-4 opacity-50" />
              </Link>
            </Button>
            <Button variant="outline" className="justify-between h-auto py-3" asChild>
              <Link to="/admin/trabajadores">
                <span className="flex items-center gap-2">
                  <Contact2 className="h-4 w-4 text-primary" />
                  {t("admin.dashboard.link_workers_full")}
                </span>
                <ArrowRight className="h-4 w-4 opacity-50" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
