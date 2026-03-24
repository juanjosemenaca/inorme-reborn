import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { ClientContactPerson } from "@/types/clients";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { optionalEmail } from "@/lib/zodOptional";

const schema = z
  .object({
    firstName: z.string(),
    lastName: z.string(),
    email: optionalEmail,
    mobile: z.string(),
    position: z.string(),
    description: z.string().optional(),
  })
  .refine((d) => d.firstName.trim().length > 0 || d.lastName.trim().length > 0, {
    message: "Indica al menos nombre o apellidos",
    path: ["firstName"],
  });

export type ContactPersonFormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: ClientContactPerson | null;
  onSubmit: (values: ContactPersonFormValues) => void | Promise<void>;
};

export function ContactPersonFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit,
}: Props) {
  const form = useForm<ContactPersonFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      mobile: "",
      position: "",
      description: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initial) {
      form.reset({
        firstName: initial.firstName,
        lastName: initial.lastName,
        email: initial.email,
        mobile: initial.mobile,
        position: initial.position,
        description: initial.description ?? "",
      });
    } else {
      form.reset({
        firstName: "",
        lastName: "",
        email: "",
        mobile: "",
        position: "",
        description: "",
      });
    }
  }, [open, mode, initial, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nueva persona de contacto" : "Editar persona de contacto"}
          </DialogTitle>
          <DialogDescription>
            Datos de la persona que actúa como interlocutor con este cliente.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => onSubmit(v))}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apellidos</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mobile"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Móvil</FormLabel>
                    <FormControl>
                      <Input type="tel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Posición / cargo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. Responsable de compras" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Rol en el proyecto, horario preferido, notas..."
                        className="min-h-[80px] resize-y"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
