import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { ProviderRecord } from "@/types/providers";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  tradeName: z.string().min(1, "Obligatorio"),
  companyName: z.string().min(1, "Obligatorio"),
  cif: z.string().min(5, "CIF/NIF obligatorio"),
  fiscalAddress: z.string().min(3, "Dirección fiscal obligatoria"),
  phone: z.string().min(5, "Teléfono obligatorio"),
  contactEmail: z.string().email("Email no válido"),
  notes: z.string().optional(),
  active: z.boolean(),
});

export type ProviderFormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: ProviderRecord | null;
  onSubmit: (values: ProviderFormValues) => void;
};

export function ProviderFormDialog({ open, onOpenChange, mode, initial, onSubmit }: Props) {
  const form = useForm<ProviderFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tradeName: "",
      companyName: "",
      cif: "",
      fiscalAddress: "",
      phone: "",
      contactEmail: "",
      notes: "",
      active: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initial) {
      form.reset({
        tradeName: initial.tradeName,
        companyName: initial.companyName,
        cif: initial.cif,
        fiscalAddress: initial.fiscalAddress,
        phone: initial.phone,
        contactEmail: initial.contactEmail,
        notes: initial.notes ?? "",
        active: initial.active,
      });
    } else {
      form.reset({
        tradeName: "",
        companyName: "",
        cif: "",
        fiscalAddress: "",
        phone: "",
        contactEmail: "",
        notes: "",
        active: true,
      });
    }
  }, [open, mode, initial, form]);

  const title = useMemo(
    () => (mode === "create" ? "Nuevo proveedor" : "Editar proveedor"),
    [mode]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Mismos datos de alta que un cliente: fiscal, contacto y personas de contacto aparte.
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
                name="tradeName"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Nombre comercial</FormLabel>
                    <FormControl>
                      <Input placeholder="Marca o nombre comercial" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Razón social / nombre empresa</FormLabel>
                    <FormControl>
                      <Input placeholder="Razón social completa" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cif"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>CIF / NIF</FormLabel>
                    <FormControl>
                      <Input placeholder="B12345678" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fiscalAddress"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Dirección fiscal</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Calle, número, CP, población, provincia"
                        className="min-h-[72px] resize-y"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="+34 ..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email contacto</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="contacto@empresa.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Notas internas</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Observaciones (solo uso interno)"
                        className="min-h-[60px] resize-y"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2 flex flex-row items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel className="text-base">Proveedor activo</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Desactiva si ya no trabajas con este proveedor.
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
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
