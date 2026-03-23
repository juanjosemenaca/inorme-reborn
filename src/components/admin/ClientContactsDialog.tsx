import { useState } from "react";
import { Plus, Pencil, Trash2, UserCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { ClientContactPerson, ClientRecord } from "@/types/clients";
import { contactDisplayName } from "@/types/clients";
import {
  addContact,
  removeContact,
  updateContact,
} from "@/lib/clientStore";
import {
  ContactPersonFormDialog,
  type ContactPersonFormValues,
} from "@/components/admin/ContactPersonFormDialog";
import { useToast } from "@/hooks/use-toast";

type Props = {
  client: ClientRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ClientContactsDialog({ client, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<ClientContactPerson | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientContactPerson | null>(null);

  if (!client) return null;

  const openCreate = () => {
    setFormMode("create");
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (p: ClientContactPerson) => {
    setFormMode("edit");
    setEditing(p);
    setFormOpen(true);
  };

  const handleSubmit = (values: ContactPersonFormValues) => {
    try {
      if (formMode === "create") {
        addContact(client.id, values);
        toast({ title: "Contacto añadido" });
      } else if (editing) {
        updateContact(client.id, editing.id, values);
        toast({ title: "Contacto actualizado" });
      }
      setFormOpen(false);
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
      removeContact(client.id, deleteTarget.id);
      toast({ title: "Contacto eliminado" });
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle2 className="h-5 w-5 text-primary" />
              Personas de contacto
            </DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{client.tradeName}</span>
              {" · "}
              {client.companyName}
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end mb-2">
            <Button size="sm" className="gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Añadir contacto
            </Button>
          </div>

          {client.contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg bg-muted/30">
              No hay personas de contacto. Añade la primera con el botón superior.
            </p>
          ) : (
            <ul className="space-y-3">
              {client.contacts.map((p) => (
                <li
                  key={p.id}
                  className="rounded-lg border bg-card text-card-foreground shadow-sm px-4 py-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div>
                        <p className="font-medium">{contactDisplayName(p)}</p>
                        <p className="text-sm text-muted-foreground">{p.position}</p>
                      </div>
                      <div className="text-sm">
                        <p>{p.email}</p>
                        <p className="text-muted-foreground">{p.mobile}</p>
                      </div>
                      <div className="rounded-md bg-muted/50 border border-border/60 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                          Descripción / comentario
                        </p>
                        {p.description?.trim() ? (
                          <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                            {p.description}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">Sin comentario</p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1 sm:flex-col sm:items-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => openEdit(p)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(p)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <ContactPersonFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initial={editing}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar contacto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará{" "}
              {deleteTarget ? contactDisplayName(deleteTarget) : ""} de este cliente. Esta acción no
              se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
