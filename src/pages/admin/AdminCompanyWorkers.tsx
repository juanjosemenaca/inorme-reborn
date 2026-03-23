import { useMemo, useState } from "react";
import { Contact2, Plus, Pencil, Trash2, Search } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useCompanyWorkers } from "@/hooks/useCompanyWorkers";
import { useProviders } from "@/hooks/useProviders";
import {
  createCompanyWorker,
  updateCompanyWorker,
  deleteCompanyWorker,
} from "@/lib/companyWorkerStore";
import { hasUsersLinkedToCompanyWorker } from "@/lib/backofficeUserStore";
import type { CompanyWorkerRecord } from "@/types/companyWorkers";
import {
  COMPANY_WORKER_EMPLOYMENT_LABELS,
  AUTONOMO_VIA_LABELS,
  companyWorkerDisplayName,
} from "@/types/companyWorkers";
import { WorkerFormDialog, type WorkerFormValues } from "@/components/admin/WorkerFormDialog";
import { useToast } from "@/hooks/use-toast";

const AdminCompanyWorkers = () => {
  const workers = useCompanyWorkers();
  const providers = useProviders();
  const { toast } = useToast();
  const [query, setQuery] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<CompanyWorkerRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompanyWorkerRecord | null>(null);

  const providerOptions = useMemo(
    () =>
      providers
        .filter((p) => p.active)
        .map((p) => ({
          id: p.id,
          label: `${p.tradeName} — ${p.companyName}`,
        })),
    [providers]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter((w) => {
      const provLabel =
        w.providerId && providers.find((p) => p.id === w.providerId)?.tradeName;
      const hay = [
        w.firstName,
        w.lastName,
        w.dni,
        w.email,
        w.city,
        provLabel ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [workers, query, providers]);

  const openCreate = () => {
    setDialogMode("create");
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (w: CompanyWorkerRecord) => {
    setDialogMode("edit");
    setEditing(w);
    setDialogOpen(true);
  };

  const handleFormSubmit = (values: WorkerFormValues) => {
    try {
      const payload = {
        firstName: values.firstName,
        lastName: values.lastName,
        dni: values.dni,
        email: values.email,
        mobile: values.mobile,
        postalAddress: values.postalAddress,
        city: values.city,
        employmentType: values.employmentType,
        providerId: values.providerId?.trim() || null,
        autonomoVia: values.employmentType === "AUTONOMO" ? values.autonomoVia ?? null : null,
        active: values.active,
      };

      if (dialogMode === "create") {
        createCompanyWorker(payload);
        toast({ title: "Ficha dada de alta" });
      } else if (editing) {
        updateCompanyWorker(editing.id, payload);
        toast({ title: "Ficha actualizada" });
      }
      setDialogOpen(false);
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo guardar",
        variant: "destructive",
      });
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (hasUsersLinkedToCompanyWorker(deleteTarget.id)) {
      toast({
        title: "No permitido",
        description:
          "Este trabajador tiene un usuario de acceso en Usuarios. Elimina o cambia esa cuenta primero.",
        variant: "destructive",
      });
      setDeleteTarget(null);
      return;
    }
    try {
      deleteCompanyWorker(deleteTarget.id);
      toast({ title: "Ficha eliminada" });
      setDeleteTarget(null);
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo eliminar",
        variant: "destructive",
      });
    }
  };

  const providerLabel = (w: CompanyWorkerRecord) => {
    if (!w.providerId) return "—";
    const p = providers.find((x) => x.id === w.providerId);
    return p ? p.tradeName : "—";
  };

  const employmentExtra = (w: CompanyWorkerRecord) => {
    if (w.employmentType === "AUTONOMO" && w.autonomoVia) {
      return AUTONOMO_VIA_LABELS[w.autonomoVia];
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Contact2 className="h-7 w-7 text-primary" />
            Trabajadores
          </h2>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
            Alta de personas que trabajan en la compañía. Los subcontratados y autónomos por empresa se
            vinculan a un <strong>proveedor</strong> dado de alta en su apartado.
          </p>
        </div>
        <Button className="gap-2 shrink-0" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nueva ficha
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Listado</CardTitle>
              <CardDescription>
                {workers.length} ficha{workers.length === 1 ? "" : "s"}
              </CardDescription>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, DNI, ciudad…"
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <div className="px-6 pb-6 overflow-x-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {query.trim() ? "Sin resultados." : "No hay fichas."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Persona</TableHead>
                  <TableHead>DNI</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Empresa (proveedor)</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right w-[100px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">
                      <div>{companyWorkerDisplayName(w)}</div>
                      <div className="text-xs text-muted-foreground">{w.city}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{w.dni}</TableCell>
                    <TableCell>
                      <div className="text-sm">{w.email}</div>
                      <div className="text-xs text-muted-foreground">{w.mobile}</div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <Badge variant="secondary" className="font-normal">
                          {COMPANY_WORKER_EMPLOYMENT_LABELS[w.employmentType]}
                        </Badge>
                      </div>
                      {employmentExtra(w) && (
                        <p className="text-xs text-muted-foreground mt-1 max-w-[180px]">
                          {employmentExtra(w)}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm max-w-[160px] truncate">
                      {providerLabel(w)}
                    </TableCell>
                    <TableCell>
                      {w.active ? (
                        <Badge className="bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-600/20 border-0">
                          Activo
                        </Badge>
                      ) : (
                        <Badge variant="outline">Inactivo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(w)}
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteTarget(w)}
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      <WorkerFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        initial={editing}
        providerOptions={providerOptions}
        onSubmit={handleFormSubmit}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar ficha?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la ficha de{" "}
              <strong>{deleteTarget ? companyWorkerDisplayName(deleteTarget) : ""}</strong>.
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

export default AdminCompanyWorkers;
