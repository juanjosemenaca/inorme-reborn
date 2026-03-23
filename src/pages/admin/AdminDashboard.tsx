import { Mail, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminDashboardAdmin } from "@/components/admin/AdminDashboardAdmin";
import { MOCK_MESSAGES } from "@/data/mockBackofficeMessages";
import { useMemo } from "react";

const AdminDashboard = () => {
  const { user, isAdmin, isWorker } = useAdminAuth();

  const msgCount = useMemo(() => {
    if (!user) return 0;
    if (isAdmin) return MOCK_MESSAGES.length;
    return MOCK_MESSAGES.filter((m) => m.assignedToUserId === user.userId).length;
  }, [user, isAdmin]);

  if (isAdmin && user) {
    return <AdminDashboardAdmin session={user} />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Panel</h2>
        <p className="text-muted-foreground text-sm mt-1">
          {isWorker && (
            <>
              Como <strong>trabajador</strong> puedes consultar tus mensajes asignados y los datos que
              tengas permiso para ver.
            </>
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mis mensajes</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{msgCount}</div>
            <CardDescription className="mt-1">
              <Button variant="link" className="h-auto p-0" asChild>
                <Link to="/admin/mensajes">Ver listado</Link>
              </Button>
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tu rol</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">Trabajador</div>
            <CardDescription className="mt-1">Acceso a tus datos y mensajes asignados.</CardDescription>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de demostración</CardTitle>
          <CardDescription>
            Los mensajes mostrados son de ejemplo hasta integrar datos reales.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
};

export default AdminDashboard;
