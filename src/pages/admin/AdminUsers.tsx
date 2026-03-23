import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, UserX, UserCheck } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useBackofficeUsers } from "@/hooks/useBackofficeUsers";
import { useCompanyWorkers } from "@/hooks/useCompanyWorkers";
import {
  createUser,
  updateUser,
  deleteUser,
  countAdmins,
  getResolvedDisplayName,
} from "@/lib/backofficeUserStore";
import type { BackofficeUserRecord } from "@/types/backoffice";
import { EMPLOYMENT_LABELS } from "@/types/backoffice";
import { getCompanyWorkerById } from "@/lib/companyWorkerStore";
import {
  UserFormDialog,
  type UserCreateFormValues,
  type UserEditFormValues,
} from "@/components/admin/UserFormDialog";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";

function initialsFromDisplayName(name: string) {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase() || "??";
}

const AdminUsers = () => {
  const users = useBackofficeUsers();
  const companyWorkers = useCompanyWorkers();
  const { user: session, refreshSession } = useAdminAuth();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<BackofficeUserRecord | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<BackofficeUserRecord | null>(null);

  const selectableWorkers = useMemo(
    () =>
      companyWorkers.filter(
        (w) => w.active && !users.some((u) => u.companyWorkerId === w.id)
      ),
    [companyWorkers, users]
  );

  const linkedWorkerForEdit = useMemo(() => {
    if (!editing?.companyWorkerId) return null;
    return getCompanyWorkerById(editing.companyWorkerId) ?? null;
  }, [editing]);

  const openCreate = () => {
    setDialogMode("create");
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (u: BackofficeUserRecord) => {
    setDialogMode("edit");
    setEditing(u);
    setDialogOpen(true);
  };

  const handleSubmitCreate = (values: UserCreateFormValues) => {
    try {
      createUser({
        companyWorkerId: values.companyWorkerId,
        email: values.email,
        password: values.password,
        role: values.role,
        active: values.active,
      });
      toast({ title: "Usuario dado de alta" });
      setDialogOpen(false);
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Operación no realizada",
        variant: "destructive",
      });
    }
  };

  const handleSubmitEdit = (values: UserEditFormValues) => {
    if (!editing) return;
    try {
      const isLastAdmin =
        editing.role === "ADMIN" &&
        countAdmins() === 1 &&
        values.role === "WORKER";
      if (isLastAdmin) {
        toast({
          title: "No permitido",
          description: "No puedes quitar el rol de administrador al único admin.",
          variant: "destructive",
        });
        return;
      }
      updateUser(editing.id, {
        email: values.email,
        role: values.role,
        active: values.active,
        password: values.password && values.password.length > 0 ? values.password : undefined,
      });
      toast({ title: "Usuario actualizado" });
      setDialogOpen(false);
      if (session?.userId === editing.id) {
        refreshSession();
      }
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Operación no realizada",
        variant: "destructive",
      });
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (session?.userId === deleteTarget.id) {
      toast({
        title: "No permitido",
        description: "No puedes eliminar tu propia cuenta con la sesión activa.",
        variant: "destructive",
      });
      setDeleteTarget(null);
      return;
    }
    try {
      deleteUser(deleteTarget.id);
      toast({ title: "Usuario eliminado" });
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    }
    setDeleteTarget(null);
  };

  const toggleActive = (u: BackofficeUserRecord) => {
    if (session?.userId === u.id && u.active) {
      toast({
        title: "No permitido",
        description: "Cierra sesión antes de desactivarte a ti mismo.",
        variant: "destructive",
      });
      return;
    }
    if (u.role === "ADMIN" && u.active && countAdmins() === 1) {
      toast({
        title: "No permitido",
        description: "No puedes desactivar al único administrador.",
        variant: "destructive",
      });
      return;
    }
    try {
      updateUser(u.id, { active: !u.active });
      toast({ title: u.active ? "Usuario desactivado" : "Usuario reactivado" });
      if (session?.userId === u.id) refreshSession();
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuarios del backoffice</h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
            Cada cuenta se asocia a una <strong>ficha de trabajador</strong> (datos en Trabajadores). Aquí defines
            email de acceso, contraseña y rol (administrador o trabajador).
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>

      <Card className="border-primary/15 bg-gradient-to-br from-card to-primary/5">
        <CardHeader>
          <CardTitle className="text-base">Datos personales</CardTitle>
          <CardDescription>
            Se toman de la ficha en <strong>Trabajadores</strong>. Al crear un usuario eliges el trabajador; el
            email de acceso por defecto es el de esa ficha (puedes cambiarlo). Cuentas antiguas sin ficha siguen
            funcionando.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="shadow-sm border-slate-200/80">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-base">Directorio</CardTitle>
            <CardDescription>{users.length} usuarios</CardDescription>
          </div>
        </CardHeader>
        <div className="px-6 pb-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[48px]" />
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>DNI</TableHead>
                <TableHead>Móvil</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right w-[200px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const displayName = getResolvedDisplayName(u);
                return (
                  <TableRow key={u.id} className={!u.active ? "opacity-60" : undefined}>
                    <TableCell>
                      <Avatar className="h-9 w-9 border">
                        <AvatarFallback
                          className={
                            u.role === "ADMIN"
                              ? "bg-primary/15 text-primary text-xs font-semibold"
                              : "bg-muted text-xs font-semibold"
                          }
                        >
                          {initialsFromDisplayName(displayName)}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{displayName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[180px] truncate">
                      {u.email}
                    </TableCell>
                    <TableCell className="text-sm">{u.dni}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{u.mobile}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {EMPLOYMENT_LABELS[u.employmentType]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>
                        {u.role === "ADMIN" ? "Admin" : "Trabajador"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.active ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600">Activo</Badge>
                      ) : (
                        <Badge variant="secondary">Inactivo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(u)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleActive(u)}
                          title={u.active ? "Desactivar" : "Reactivar"}
                        >
                          {u.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(u)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <UserFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        initial={editing}
        selectableWorkers={selectableWorkers}
        linkedWorker={linkedWorkerForEdit}
        onSubmitCreate={handleSubmitCreate}
        onSubmitEdit={handleSubmitEdit}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará de forma permanente a{" "}
              <strong>{deleteTarget ? getResolvedDisplayName(deleteTarget) : ""}</strong>. La ficha en Trabajadores no
              se elimina.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsers;
