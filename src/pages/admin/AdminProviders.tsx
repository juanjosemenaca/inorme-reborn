import { useEffect, useMemo, useState } from "react";
import { Truck, Plus, Pencil, Trash2, Users, Search } from "lucide-react";
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
import { useProviders } from "@/hooks/useProviders";
import {
  createProvider,
  updateProvider,
  deleteProvider,
} from "@/lib/providerStore";
import { clearProviderLinksFromWorkers } from "@/lib/companyWorkerStore";
import type { ProviderRecord } from "@/types/providers";
import { ProviderFormDialog, type ProviderFormValues } from "@/components/admin/ProviderFormDialog";
import { ProviderContactsDialog } from "@/components/admin/ProviderContactsDialog";
import { useToast } from "@/hooks/use-toast";

const AdminProviders = () => {
  const providers = useProviders();
  const { toast } = useToast();
  const [query, setQuery] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<ProviderRecord | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ProviderRecord | null>(null);

  const [contactsId, setContactsId] = useState<string | null>(null);
  const contactsProvider = useMemo(
    () => providers.find((p) => p.id === contactsId) ?? null,
    [providers, contactsId]
  );

  useEffect(() => {
    if (contactsId && !contactsProvider) {
      setContactsId(null);
    }
  }, [contactsId, contactsProvider]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter(
      (p) =>
        p.tradeName.toLowerCase().includes(q) ||
        p.companyName.toLowerCase().includes(q) ||
        p.cif.toLowerCase().includes(q) ||
        p.contactEmail.toLowerCase().includes(q)
    );
  }, [providers, query]);

  const openCreate = () => {
    setDialogMode("create");
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (p: ProviderRecord) => {
    setDialogMode("edit");
    setEditing(p);
    setDialogOpen(true);
  };

  const handleFormSubmit = (values: ProviderFormValues) => {
    try {
      if (dialogMode === "create") {
        createProvider({
          tradeName: values.tradeName,
          companyName: values.companyName,
          cif: values.cif,
          fiscalAddress: values.fiscalAddress,
          phone: values.phone,
          contactEmail: values.contactEmail,
          notes: values.notes ?? "",
          active: values.active,
        });
        toast({ title: "Proveedor dado de alta" });
      } else if (editing) {
        updateProvider(editing.id, {
          tradeName: values.tradeName,
          companyName: values.companyName,
          cif: values.cif,
          fiscalAddress: values.fiscalAddress,
          phone: values.phone,
          contactEmail: values.contactEmail,
          notes: values.notes ?? "",
          active: values.active,
        });
        toast({ title: "Proveedor actualizado" });
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
    try {
      clearProviderLinksFromWorkers(deleteTarget.id);
      deleteProvider(deleteTarget.id);
      toast({ title: "Proveedor eliminado" });
      setDeleteTarget(null);
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo eliminar",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Truck className="h-7 w-7 text-primary" />
            Proveedores
          </h2>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
            Empresas externas (autónomos societarios, subcontratas, etc.) con los mismos datos de alta
            que un cliente: fiscal, contacto y personas de contacto.
          </p>
        </div>
        <Button className="gap-2 shrink-0" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo proveedor
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Listado</CardTitle>
              <CardDescription>
                {providers.length} proveedor{providers.length === 1 ? "" : "es"}
              </CardDescription>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar…"
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
              {query.trim() ? "Sin resultados." : "No hay proveedores."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre comercial</TableHead>
                  <TableHead>Razón social</TableHead>
                  <TableHead>CIF</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right w-[200px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.tradeName}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {p.companyName}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{p.cif}</TableCell>
                    <TableCell>
                      <div className="text-sm">{p.contactEmail}</div>
                      <div className="text-xs text-muted-foreground">{p.phone}</div>
                    </TableCell>
                    <TableCell>
                      {p.active ? (
                        <Badge className="bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-600/20 border-0">
                          Activo
                        </Badge>
                      ) : (
                        <Badge variant="outline">Inactivo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 mr-1"
                        onClick={() => setContactsId(p.id)}
                      >
                        <Users className="h-3.5 w-3.5" />
                        Contactos
                        {p.contacts.length > 0 && (
                          <span className="tabular-nums">({p.contacts.length})</span>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(p)}
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteTarget(p)}
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

      <ProviderFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        initial={editing}
        onSubmit={handleFormSubmit}
      />

      <ProviderContactsDialog
        provider={contactsProvider}
        open={!!contactsId && !!contactsProvider}
        onOpenChange={(o) => {
          if (!o) setContactsId(null);
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proveedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deleteTarget?.tradeName}</strong>. Los trabajadores vinculados
              dejarán de tener empresa asignada (subcontratado / autónomo por empresa).
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

export default AdminProviders;
