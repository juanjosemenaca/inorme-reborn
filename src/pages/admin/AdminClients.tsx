import { useEffect, useMemo, useState } from "react";
import { Building2, Plus, Pencil, Trash2, Users, Search } from "lucide-react";
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
import { useClients } from "@/hooks/useClients";
import {
  createClient,
  updateClient,
  deleteClient,
} from "@/lib/clientStore";
import type { ClientRecord } from "@/types/clients";
import { CLIENT_KIND_LABELS } from "@/types/clients";
import { ClientFormDialog, type ClientFormValues } from "@/components/admin/ClientFormDialog";
import { ClientContactsDialog } from "@/components/admin/ClientContactsDialog";
import { useToast } from "@/hooks/use-toast";

const AdminClients = () => {
  const clients = useClients();
  const { toast } = useToast();
  const [query, setQuery] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<ClientRecord | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ClientRecord | null>(null);

  const [contactsClientId, setContactsClientId] = useState<string | null>(null);
  const contactsClient = useMemo(
    () => clients.find((c) => c.id === contactsClientId) ?? null,
    [clients, contactsClientId]
  );

  useEffect(() => {
    if (contactsClientId && !contactsClient) {
      setContactsClientId(null);
    }
  }, [contactsClientId, contactsClient]);

  const finalClientOptions = useMemo(() => {
    return clients
      .filter((c) => c.clientKind === "FINAL" && c.id !== editing?.id)
      .map((c) => ({
        id: c.id,
        label: `${c.tradeName} — ${c.companyName}`,
      }));
  }, [clients, editing]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const linkedName =
        c.linkedFinalClientId &&
        clients.find((x) => x.id === c.linkedFinalClientId)?.tradeName;
      const hay = [
        c.tradeName,
        c.companyName,
        c.cif,
        c.contactEmail,
        linkedName ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [clients, query]);

  const openCreate = () => {
    setDialogMode("create");
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (c: ClientRecord) => {
    setDialogMode("edit");
    setEditing(c);
    setDialogOpen(true);
  };

  const handleFormSubmit = (values: ClientFormValues) => {
    try {
      if (dialogMode === "create") {
        createClient({
          tradeName: values.tradeName,
          companyName: values.companyName,
          cif: values.cif,
          fiscalAddress: values.fiscalAddress,
          clientKind: values.clientKind,
          linkedFinalClientId:
            values.clientKind === "INTERMEDIARIO"
              ? values.linkedFinalClientId?.trim() || null
              : null,
          phone: values.phone,
          contactEmail: values.contactEmail,
          notes: values.notes ?? "",
          active: values.active,
        });
        toast({ title: "Cliente dado de alta" });
      } else if (editing) {
        updateClient(editing.id, {
          tradeName: values.tradeName,
          companyName: values.companyName,
          cif: values.cif,
          fiscalAddress: values.fiscalAddress,
          clientKind: values.clientKind,
          linkedFinalClientId:
            values.clientKind === "INTERMEDIARIO"
              ? values.linkedFinalClientId?.trim() || null
              : null,
          phone: values.phone,
          contactEmail: values.contactEmail,
          notes: values.notes ?? "",
          active: values.active,
        });
        toast({ title: "Cliente actualizado" });
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
      deleteClient(deleteTarget.id);
      toast({ title: "Cliente eliminado" });
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
            <Building2 className="h-7 w-7 text-primary" />
            Clientes
          </h2>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
            Alta y seguimiento de clientes: datos fiscales, tipo (final o intermediario) y personas de
            contacto por empresa.
          </p>
        </div>
        <Button className="gap-2 shrink-0" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Listado</CardTitle>
              <CardDescription>
                {clients.length} cliente{clients.length === 1 ? "" : "s"} en total
              </CardDescription>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, CIF, email, cliente final…"
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
              {query.trim() ? "Ningún cliente coincide con la búsqueda." : "No hay clientes."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre comercial</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CIF</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="min-w-[140px]">Cliente final</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right w-[200px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.tradeName}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {c.companyName}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{c.cif}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {CLIENT_KIND_LABELS[c.clientKind]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {c.clientKind === "INTERMEDIARIO" ? (
                        c.linkedFinalClientId ? (
                          <span className="text-sm">
                            {clients.find((x) => x.id === c.linkedFinalClientId)?.tradeName ?? "—"}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No indicado</span>
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{c.contactEmail}</div>
                      <div className="text-xs text-muted-foreground">{c.phone}</div>
                    </TableCell>
                    <TableCell>
                      {c.active ? (
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
                        onClick={() => setContactsClientId(c.id)}
                      >
                        <Users className="h-3.5 w-3.5" />
                        Contactos
                        {c.contacts.length > 0 && (
                          <span className="tabular-nums">({c.contacts.length})</span>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(c)}
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteTarget(c)}
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

      <ClientFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        initial={editing}
        finalClientOptions={finalClientOptions}
        onSubmit={handleFormSubmit}
      />

      <ClientContactsDialog
        client={contactsClient}
        open={!!contactsClientId && !!contactsClient}
        onOpenChange={(o) => {
          if (!o) setContactsClientId(null);
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deleteTarget?.tradeName}</strong> y todas sus personas de contacto.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminClients;
