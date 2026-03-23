import { Link } from "react-router-dom";
import {
  Mail,
  Users2,
  Building2,
  Truck,
  Contact2,
  ArrowRight,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MOCK_MESSAGES } from "@/data/mockBackofficeMessages";
import { useBackofficeUsers } from "@/hooks/useBackofficeUsers";
import { useClients } from "@/hooks/useClients";
import { useProviders } from "@/hooks/useProviders";
import { useCompanyWorkers } from "@/hooks/useCompanyWorkers";
import type { BackofficeSession } from "@/types/backoffice";
import { useMemo } from "react";
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
  const allUsers = useBackofficeUsers();
  const allClients = useClients();
  const allProviders = useProviders();
  const allCompanyWorkers = useCompanyWorkers();
  const msgTotal = MOCK_MESSAGES.length;
  const sinAsignar = MOCK_MESSAGES.filter((m) => !m.assignedToUserId).length;
  const userCount = allUsers.length;
  const clientCount = allClients.length;
  const providerCount = allProviders.length;
  const workerCount = allCompanyWorkers.length;

  const recientes = useMemo(
    () =>
      [...MOCK_MESSAGES]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 4),
    []
  );

  return (
    <div className="space-y-8">
      {/* Cabecera */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Panel de control</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Hola, {session.name.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-xl">
            Vista global del backoffice Inorme: mensajes, usuarios, clientes, proveedores y plantilla.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {new Date().toLocaleDateString("es-ES", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-card to-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Mensajes totales
            </CardTitle>
            <div className="rounded-lg bg-primary/15 p-2">
              <Mail className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{msgTotal}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {sinAsignar} sin asignar
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cuentas backoffice
            </CardTitle>
            <div className="rounded-lg bg-muted p-2">
              <Users2 className="h-4 w-4 text-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{userCount}</div>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link to="/admin/usuarios">Ver usuarios</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Clientes
            </CardTitle>
            <div className="rounded-lg bg-muted p-2">
              <Building2 className="h-4 w-4 text-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{clientCount}</div>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link to="/admin/clientes">Ver clientes</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Proveedores
            </CardTitle>
            <div className="rounded-lg bg-muted p-2">
              <Truck className="h-4 w-4 text-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{providerCount}</div>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link to="/admin/proveedores">Ver proveedores</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Trabajadores
            </CardTitle>
            <div className="rounded-lg bg-muted p-2">
              <Contact2 className="h-4 w-4 text-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{workerCount}</div>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link to="/admin/trabajadores">Ver plantilla</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Gráfico */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Contactos (demostración)</CardTitle>
            <CardDescription>Volumen mensual de ejemplo hasta integrar datos reales.</CardDescription>
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

        {/* Accesos rápidos */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Accesos rápidos</CardTitle>
            <CardDescription>Gestión diaria</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button variant="outline" className="justify-between h-auto py-3" asChild>
              <Link to="/admin/mensajes">
                <span className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  Bandeja de mensajes
                </span>
                <ArrowRight className="h-4 w-4 opacity-50" />
              </Link>
            </Button>
            <Button variant="outline" className="justify-between h-auto py-3" asChild>
              <Link to="/admin/usuarios">
                <span className="flex items-center gap-2">
                  <Users2 className="h-4 w-4 text-primary" />
                  Usuarios y roles
                </span>
                <ArrowRight className="h-4 w-4 opacity-50" />
              </Link>
            </Button>
            <Button variant="outline" className="justify-between h-auto py-3" asChild>
              <Link to="/admin/clientes">
                <span className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Clientes y contactos
                </span>
                <ArrowRight className="h-4 w-4 opacity-50" />
              </Link>
            </Button>
            <Button variant="outline" className="justify-between h-auto py-3" asChild>
              <Link to="/admin/proveedores">
                <span className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary" />
                  Proveedores
                </span>
                <ArrowRight className="h-4 w-4 opacity-50" />
              </Link>
            </Button>
            <Button variant="outline" className="justify-between h-auto py-3" asChild>
              <Link to="/admin/trabajadores">
                <span className="flex items-center gap-2">
                  <Contact2 className="h-4 w-4 text-primary" />
                  Trabajadores (plantilla)
                </span>
                <ArrowRight className="h-4 w-4 opacity-50" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Últimos mensajes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Últimos mensajes</CardTitle>
            <CardDescription>Ordenados por fecha</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/mensajes">Ver todo</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="divide-y rounded-lg border">
            {recientes.map((m) => (
              <div
                key={m.id}
                className="flex flex-col gap-1 py-3 px-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-sm">{m.subject}</p>
                  <p className="text-xs text-muted-foreground">{m.fromEmail}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{m.date}</span>
                  {!m.assignedToUserId && (
                    <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 dark:bg-amber-950 dark:text-amber-200">
                      Sin asignar
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
