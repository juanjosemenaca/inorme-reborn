import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { addContact, removeContact, updateContact } from "@/api/clientsApi";
import { queryKeys } from "@/lib/queryKeys";
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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<ClientContactPerson | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientContactPerson | null>(null);

  if (!client) return null;

  const generalContacts = client.contacts.filter(
    (p) => (p.contactPurpose ?? "GENERAL") === "GENERAL"
  );

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

  const handleSubmit = async (values: ContactPersonFormValues) => {
    try {
      if (formMode === "create") {
        await addContact(client.id, { ...values, contactPurpose: "GENERAL" });
        toast({ title: "Contacto añadido" });
      } else if (editing) {
        await updateContact(client.id, editing.id, {
          ...values,
          contactPurpose: editing.contactPurpose ?? "GENERAL",
        });
        toast({ title: "Contacto actualizado" });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.clients });
      setFormOpen(false);
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo guardar",
        variant: "destructive",
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeContact(client.id, deleteTarget.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.clients });
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle2 className="h-5 w-5" />
              Contactos — {client.tradeName}
            </DialogTitle>
            <DialogDescription>
              Personas de contacto del cliente. Los destinatarios de facturación se indican en la ficha del
              cliente (campo de texto).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Personas de contacto
            </p>
            <div className="flex justify-end">
              <Button size="sm" className="gap-1" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Añadir contacto
              </Button>
            </div>
            {generalContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No hay contactos.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {generalContacts.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-2 p-3 text-sm">
                    <div>
                      <div className="font-medium">{contactDisplayName(p)}</div>
                      <div className="text-muted-foreground text-xs">{p.email}</div>
                      {p.position && (
                        <div className="text-muted-foreground text-xs mt-0.5">{p.position}</div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteTarget(p)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
              Se eliminará a <strong>{deleteTarget ? contactDisplayName(deleteTarget) : ""}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
