import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { AutonomoVia, CompanyWorkerEmploymentType, CompanyWorkerRecord } from "@/types/companyWorkers";
import {
  COMPANY_WORKER_EMPLOYMENT_LABELS,
  AUTONOMO_VIA_LABELS,
} from "@/types/companyWorkers";
import type { WorkCalendarSiteRecord } from "@/types/workCalendars";
import { useLanguage } from "@/contexts/LanguageContext";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { optionalEmail } from "@/lib/zodOptional";

const employmentEnum = z.enum([
  "FIJO",
  "TEMPORAL",
  "SUBCONTRATADO",
  "PRACTICAS",
  "AUTONOMO",
]);
const autonomoViaEnum = z.enum(["CUENTA_PROPIA", "EMPRESA"]);

const NONE_VALUE = "__none__";

const schema = z
  .object({
    firstName: z.string(),
    lastName: z.string(),
    dni: z.string(),
    email: optionalEmail,
    mobile: z.string(),
    postalAddress: z.string(),
    city: z.string(),
    workCalendarSiteId: z.string().uuid(),
    vacationDays: z.coerce.number().int().min(0).max(365),
    employmentType: employmentEnum,
    autonomoVia: autonomoViaEnum.optional().nullable(),
    providerId: z.string().optional(),
    active: z.boolean(),
  })
  .refine((d) => d.firstName.trim().length > 0 || d.lastName.trim().length > 0, {
    message: "Indica al menos nombre o apellidos",
    path: ["firstName"],
  })
  .superRefine((data, ctx) => {
    if (data.employmentType === "SUBCONTRATADO" && !data.providerId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecciona el proveedor (empresa)",
        path: ["providerId"],
      });
    }
    if (data.employmentType === "AUTONOMO") {
      if (!data.autonomoVia) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Indica si es por cuenta propia o por empresa",
          path: ["autonomoVia"],
        });
      }
      if (data.autonomoVia === "EMPRESA" && !data.providerId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecciona la empresa (proveedor)",
          path: ["providerId"],
        });
      }
    }
  });

export type WorkerFormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: CompanyWorkerRecord | null;
  /** Proveedores activos para subcontratado / autónomo por empresa */
  providerOptions: { id: string; label: string }[];
  /** Sedes laborales (calendarios); debe estar cargado antes de abrir el diálogo. */
  calendarSites: WorkCalendarSiteRecord[];
  onSubmit: (values: WorkerFormValues) => void | Promise<void>;
};

export function WorkerFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
  providerOptions,
  calendarSites,
  onSubmit,
}: Props) {
  const { t } = useLanguage();
  const defaultSiteId =
    calendarSites.find((s) => s.slug === "BARCELONA")?.id ?? calendarSites[0]?.id ?? "";
  const defaultVacation =
    calendarSites.find((s) => s.id === defaultSiteId)?.vacationDaysDefault ?? 22;

  const form = useForm<WorkerFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dni: "",
      email: "",
      mobile: "",
      postalAddress: "",
      city: "",
      workCalendarSiteId: defaultSiteId,
      vacationDays: defaultVacation,
      employmentType: "FIJO",
      autonomoVia: null,
      providerId: "",
      active: true,
    },
  });

  const employmentType = useWatch({ control: form.control, name: "employmentType" });
  const autonomoVia = useWatch({ control: form.control, name: "autonomoVia" });

  useEffect(() => {
    if (employmentType === "FIJO" || employmentType === "TEMPORAL" || employmentType === "PRACTICAS") {
      form.setValue("providerId", "");
      form.setValue("autonomoVia", null);
    }
    if (employmentType === "SUBCONTRATADO") {
      form.setValue("autonomoVia", null);
    }
    if (employmentType === "AUTONOMO" && autonomoVia === "CUENTA_PROPIA") {
      form.setValue("providerId", "");
    }
  }, [employmentType, autonomoVia, form]);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initial) {
      form.reset({
        firstName: initial.firstName,
        lastName: initial.lastName,
        dni: initial.dni,
        email: initial.email,
        mobile: initial.mobile,
        postalAddress: initial.postalAddress,
        city: initial.city,
        workCalendarSiteId: initial.workCalendarSiteId,
        vacationDays: initial.vacationDays,
        employmentType: initial.employmentType,
        autonomoVia: initial.autonomoVia,
        providerId: initial.providerId ?? "",
        active: initial.active,
      });
    } else {
      form.reset({
        firstName: "",
        lastName: "",
        dni: "",
        email: "",
        mobile: "",
        postalAddress: "",
        city: "",
        workCalendarSiteId: defaultSiteId,
        vacationDays: defaultVacation,
        employmentType: "FIJO",
        autonomoVia: null,
        providerId: "",
        active: true,
      });
    }
  }, [open, mode, initial, form, defaultSiteId, defaultVacation]);

  const title = useMemo(
    () => (mode === "create" ? "Nueva persona" : "Editar ficha de trabajador"),
    [mode]
  );

  const showProviderSelect =
    employmentType === "SUBCONTRATADO" ||
    (employmentType === "AUTONOMO" && autonomoVia === "EMPRESA");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Personas que trabajan en la compañía. Los autónomos por empresa y subcontratados se vinculan
            a un proveedor dado de alta.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => onSubmit(v))} className="space-y-4">
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
                name="dni"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>DNI / NIE</FormLabel>
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
                  <FormItem>
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
                  <FormItem>
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
                name="postalAddress"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Dirección postal</FormLabel>
                    <FormControl>
                      <Input placeholder="Calle, número, CP…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Ciudad de residencia</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="workCalendarSiteId"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t("admin.workers.field_calendar")}</FormLabel>
                    <p className="text-sm text-muted-foreground mb-1.5">{t("admin.workers.field_calendar_desc")}</p>
                    <Select
                      onValueChange={(id) => {
                        field.onChange(id);
                        const s = calendarSites.find((x) => x.id === id);
                        if (s) form.setValue("vacationDays", s.vacationDaysDefault);
                      }}
                      value={field.value}
                      disabled={calendarSites.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("admin.workers.field_calendar")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {calendarSites.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vacationDays"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t("admin.workers.field_vacation_days")}</FormLabel>
                    <p className="text-sm text-muted-foreground mb-1.5">{t("admin.workers.field_vacation_days_desc")}</p>
                    <FormControl>
                      <Input type="number" min={0} max={365} step={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="employmentType"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Tipo de relación</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.keys(COMPANY_WORKER_EMPLOYMENT_LABELS) as CompanyWorkerEmploymentType[]).map(
                          (k) => (
                            <SelectItem key={k} value={k}>
                              {COMPANY_WORKER_EMPLOYMENT_LABELS[k]}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {employmentType === "AUTONOMO" && (
                <FormField
                  control={form.control}
                  name="autonomoVia"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2 space-y-3">
                      <FormLabel>Autónomo</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(v) => field.onChange(v as AutonomoVia)}
                          value={field.value ?? undefined}
                          className="flex flex-col gap-2"
                        >
                          {(Object.keys(AUTONOMO_VIA_LABELS) as AutonomoVia[]).map((k) => (
                            <div key={k} className="flex items-center space-x-2">
                              <RadioGroupItem value={k} id={`av-${k}`} />
                              <Label htmlFor={`av-${k}`} className="font-normal cursor-pointer">
                                {AUTONOMO_VIA_LABELS[k]}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {showProviderSelect && (
                <FormField
                  control={form.control}
                  name="providerId"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>
                        {employmentType === "SUBCONTRATADO"
                          ? "Empresa (proveedor)"
                          : "Empresa proveedora"}
                      </FormLabel>
                      <p className="text-sm text-muted-foreground mb-1.5">
                        Alta en{" "}
                        <strong>Proveedores</strong> con los mismos datos que un cliente.
                      </p>
                      <Select
                        value={field.value ? field.value : NONE_VALUE}
                        onValueChange={(v) => field.onChange(v === NONE_VALUE ? "" : v)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar proveedor…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>—</SelectItem>
                          {providerOptions.map((opt) => (
                            <SelectItem key={opt.id} value={opt.id}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {providerOptions.length === 0 && (
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                          No hay proveedores activos. Da de alta uno en Administración → Proveedores.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2 flex flex-row items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel className="text-base">Activo</FormLabel>
                      <p className="text-sm text-muted-foreground">Ficha vigente en la plantilla.</p>
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
