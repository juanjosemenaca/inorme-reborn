import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { ClientKind, ClientRecord } from "@/types/clients";
import { CLIENT_KIND_LABELS } from "@/types/clients";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { optionalEmail } from "@/lib/zodOptional";

const kindEnum = z.enum(["FINAL", "INTERMEDIARIO"]);

const NONE_VALUE = "__none__";

const schema = z
  .object({
    tradeName: z.string(),
    companyName: z.string(),
    cif: z.string(),
    postalAddress: z.string(),
    fiscalAddress: z.string(),
    fiscalAddressSameAsPostal: z.boolean(),
    clientKind: kindEnum,
    /** Vacío o id de cliente final (solo intermediarios) */
    linkedFinalClientId: z.string().optional(),
    phone: z.string(),
    contactEmail: optionalEmail,
    notes: z.string().optional(),
    active: z.boolean(),
  })
  .refine((d) => d.tradeName.trim().length > 0 || d.companyName.trim().length > 0, {
    message: "Indica al menos nombre comercial o razón social",
    path: ["tradeName"],
  })
  .refine(
    (d) =>
      d.fiscalAddressSameAsPostal
        ? d.postalAddress.trim().length > 0
        : d.fiscalAddress.trim().length > 0,
    {
      message: "Indica dirección fiscal o marca que es igual a la dirección principal",
      path: ["fiscalAddress"],
    }
  )
  .refine((d) => d.postalAddress.trim().length > 0, {
    message: "Indica la dirección principal del cliente",
    path: ["postalAddress"],
  });

export type ClientFormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: ClientRecord | null;
  /** Clientes con tipo «final» para vincular a un intermediario (excluye el propio al editar) */
  finalClientOptions: { id: string; label: string }[];
  onSubmit: (values: ClientFormValues) => void | Promise<void>;
};

export function ClientFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
  finalClientOptions,
  onSubmit,
}: Props) {
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tradeName: "",
      companyName: "",
      cif: "",
      postalAddress: "",
      fiscalAddress: "",
      fiscalAddressSameAsPostal: false,
      clientKind: "FINAL",
      linkedFinalClientId: "",
      phone: "",
      contactEmail: "",
      notes: "",
      active: true,
    },
  });

  const clientKind = useWatch({ control: form.control, name: "clientKind" });
  const fiscalAddressSameAsPostal = useWatch({
    control: form.control,
    name: "fiscalAddressSameAsPostal",
  });
  const postalAddress = useWatch({ control: form.control, name: "postalAddress" });

  useEffect(() => {
    if (clientKind === "FINAL") {
      form.setValue("linkedFinalClientId", "");
    }
  }, [clientKind, form]);

  useEffect(() => {
    if (!fiscalAddressSameAsPostal) return;
    form.setValue("fiscalAddress", postalAddress ?? "", { shouldDirty: true });
  }, [fiscalAddressSameAsPostal, postalAddress, form]);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initial) {
      form.reset({
        tradeName: initial.tradeName,
        companyName: initial.companyName,
        cif: initial.cif,
        postalAddress: initial.postalAddress,
        fiscalAddress: initial.fiscalAddress,
        fiscalAddressSameAsPostal:
          initial.postalAddress.trim().length > 0 &&
          initial.postalAddress.trim() === initial.fiscalAddress.trim(),
        clientKind: initial.clientKind,
        linkedFinalClientId: initial.linkedFinalClientId ?? "",
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
        postalAddress: "",
        fiscalAddress: "",
        fiscalAddressSameAsPostal: false,
        clientKind: "FINAL",
        linkedFinalClientId: "",
        phone: "",
        contactEmail: "",
        notes: "",
        active: true,
      });
    }
  }, [open, mode, initial, form]);

  const title = useMemo(
    () => (mode === "create" ? "Nuevo cliente" : "Editar cliente"),
    [mode]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Datos fiscales y de contacto general. Las personas de contacto se gestionan aparte.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => {
              const normalized: ClientFormValues = {
                ...v,
                fiscalAddress: v.fiscalAddressSameAsPostal ? v.postalAddress : v.fiscalAddress,
              };
              onSubmit(normalized);
            })}
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
                    <FormLabel>Nombre empresa / razón social</FormLabel>
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
                  <FormItem>
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
                name="clientKind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de cliente</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.keys(CLIENT_KIND_LABELS) as ClientKind[]).map((k) => (
                          <SelectItem key={k} value={k}>
                            {CLIENT_KIND_LABELS[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {clientKind === "INTERMEDIARIO" && (
                <FormField
                  control={form.control}
                  name="linkedFinalClientId"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Cliente final asociado</FormLabel>
                      <p className="text-sm text-muted-foreground mb-1.5">
                        Si se conoce el destinatario final a través de este intermediario, elígelo.
                        Si no, deja «No indicado».
                      </p>
                      <Select
                        value={field.value ? field.value : NONE_VALUE}
                        onValueChange={(v) =>
                          field.onChange(v === NONE_VALUE ? "" : v)
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>No indicado / desconocido</SelectItem>
                          {finalClientOptions.map((opt) => (
                            <SelectItem key={opt.id} value={opt.id}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {finalClientOptions.length === 0 && (
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                          No hay clientes con tipo «cliente final» dados de alta. Crea primero el
                          cliente final y luego podrás vincularlo aquí.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="postalAddress"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Dirección principal</FormLabel>
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
                name="fiscalAddressSameAsPostal"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2 flex flex-row items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel className="text-base">Dirección fiscal igual a la principal</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Si la marcas, copiamos automáticamente la dirección principal.
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
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
                        disabled={fiscalAddressSameAsPostal}
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
                    <FormLabel>Teléfono empresa</FormLabel>
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
                    <FormLabel>Email contacto (empresa)</FormLabel>
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
                      <FormLabel className="text-base">Cliente activo</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Desactiva si ya no trabajas con este cliente.
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
