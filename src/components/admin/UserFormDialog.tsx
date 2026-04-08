import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { BackofficeUserRecord } from "@/types/backoffice";
import type { CompanyWorkerRecord } from "@/types/companyWorkers";
import {
  companyWorkerDisplayName,
  COMPANY_WORKER_EMPLOYMENT_LABELS,
} from "@/types/companyWorkers";
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
import { PasswordInputWithToggle } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { nextPasswordRenewalDeadline } from "@/lib/passwordPolicy";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown } from "lucide-react";
const roleEnum = z.enum(["ADMIN", "WORKER"]);

export type UserCreateFormValues = {
  companyWorkerId: string;
  email: string;
  password: string;
  role: z.infer<typeof roleEnum>;
  active: boolean;
};

export type UserEditFormValues = {
  email: string;
  password?: string;
  role: z.infer<typeof roleEnum>;
  active: boolean;
  /** Ficha de trabajador vinculada (obligatoria si el rol es ADMIN). */
  companyWorkerId: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: BackofficeUserRecord | null;
  /** Trabajadores que pueden recibir usuario (activos y aún sin cuenta) */
  selectableWorkers: CompanyWorkerRecord[];
  /** Edición: fichas que pueden vincularse (incluye la del usuario editado). */
  selectableWorkersForEdit?: CompanyWorkerRecord[];
  onSubmitCreate: (values: UserCreateFormValues) => void | Promise<void>;
  onSubmitEdit: (values: UserEditFormValues) => void | Promise<void>;
};

function UserFormDialogInner({
  open,
  onOpenChange,
  mode,
  initial,
  selectableWorkers,
  selectableWorkersForEdit = [],
  onSubmitCreate,
  onSubmitEdit,
}: Props) {
  const { t, language } = useLanguage();

  const createSchema = useMemo(
    () =>
      z.object({
        companyWorkerId: z.string().min(1, t("admin.users.validation_worker")),
        email: z.string().email(t("admin.users.validation_email")),
        password: z.string().refine(
          (v) => v.length === 0 || v.length >= 8,
          t("admin.users.password_optional_refine")
        ),
        role: roleEnum,
        active: z.boolean(),
      }),
    [t]
  );

  const editSchema = useMemo(
    () =>
      z
        .object({
          email: z.string().email(t("admin.users.validation_email")),
          password: z
            .string()
            .optional()
            .refine((v) => !v || v.length >= 8, t("admin.users.edit_password_refine")),
          role: roleEnum,
          active: z.boolean(),
          companyWorkerId: z.string(),
        })
        .superRefine((data, ctx) => {
          if (data.role === "ADMIN" && !data.companyWorkerId?.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t("admin.users.validation_worker_admin"),
              path: ["companyWorkerId"],
            });
          }
        }),
    [t]
  );

  const createForm = useForm<UserCreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      companyWorkerId: "",
      email: "",
      password: "",
      role: "WORKER",
      active: true,
    },
  });

  const editForm = useForm<UserEditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      email: "",
      password: "",
      role: "WORKER",
      active: true,
      companyWorkerId: "",
    },
  });

  const [workerComboOpen, setWorkerComboOpen] = useState(false);

  const watchedWorkerId = createForm.watch("companyWorkerId");
  const selectedWorker = useMemo(
    () => selectableWorkers.find((w) => w.id === watchedWorkerId),
    [selectableWorkers, watchedWorkerId]
  );

  const watchedEditWorkerId = editForm.watch("companyWorkerId");
  const watchedEditRole = editForm.watch("role");
  const selectedEditWorker = useMemo(
    () => selectableWorkersForEdit.find((w) => w.id === watchedEditWorkerId),
    [selectableWorkersForEdit, watchedEditWorkerId]
  );

  const workerSearchValue = (w: CompanyWorkerRecord) =>
    `${w.firstName} ${w.lastName} ${w.dni} ${w.email} ${companyWorkerDisplayName(w)} ${w.id}`.trim();

  useEffect(() => {
    if (!open) setWorkerComboOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initial) {
      editForm.reset({
        email: initial.email,
        password: "",
        role: initial.role,
        active: initial.active,
        companyWorkerId: initial.companyWorkerId ?? "",
      });
    } else if (mode === "create") {
      createForm.reset({
        companyWorkerId: "",
        email: "",
        password: "",
        role: "WORKER",
        active: true,
      });
    }
  }, [open, mode, initial, createForm, editForm]);

  const title = mode === "create" ? "Alta de usuario" : "Modificar usuario";

  const localeTag =
    language === "en" ? "en-GB" : language === "ca" ? "ca-ES" : "es-ES";
  const formatShortDate = (iso: string | null) => {
    if (!iso) return t("admin.common.none");
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return t("admin.common.none");
    return d.toLocaleDateString(localeTag, { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Elige la ficha del trabajador, define el email de acceso (por defecto el de la ficha), la contraseña y el rol."
              : t("admin.users.dialog_edit_desc")}
          </DialogDescription>
        </DialogHeader>

        {mode === "create" ? (
          <Form {...createForm}>
            <form
              onSubmit={createForm.handleSubmit((v) => onSubmitCreate(v))}
              className="space-y-4"
            >
              <FormField
                control={createForm.control}
                name="companyWorkerId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Trabajador</FormLabel>
                    <Popover open={workerComboOpen} onOpenChange={setWorkerComboOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={workerComboOpen}
                            disabled={selectableWorkers.length === 0}
                            className={cn(
                              "w-full justify-between font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                              ? (() => {
                                  const w = selectableWorkers.find((x) => x.id === field.value);
                                  return w
                                    ? `${companyWorkerDisplayName(w)} · ${w.dni}`
                                    : "Selecciona una ficha…";
                                })()
                              : "Selecciona una ficha…"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[min(calc(100vw-2rem),32rem)]" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar por nombre, apellidos o DNI…" />
                          <CommandList>
                            <CommandEmpty>No hay coincidencias.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="__clear__ sin seleccionar"
                                onSelect={() => {
                                  field.onChange("");
                                  setWorkerComboOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    !field.value ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                — Sin seleccionar —
                              </CommandItem>
                              {selectableWorkers.map((w) => (
                                <CommandItem
                                  key={w.id}
                                  value={workerSearchValue(w)}
                                  onSelect={() => {
                                    field.onChange(w.id);
                                    if (w.email.trim()) {
                                      createForm.setValue(
                                        "email",
                                        w.email.trim().toLowerCase()
                                      );
                                    }
                                    setWorkerComboOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === w.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {companyWorkerDisplayName(w)} · {w.dni}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {selectableWorkers.length === 0 && (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        No hay trabajadores disponibles (activos sin usuario). Crea la ficha en
                        Trabajadores primero.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedWorker && (
                <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground space-y-1">
                  <p>
                    <span className="font-medium text-foreground">Ciudad:</span> {selectedWorker.city}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Relación:</span>{" "}
                    {COMPANY_WORKER_EMPLOYMENT_LABELS[selectedWorker.employmentType]}
                  </p>
                </div>
              )}

              <FormField
                control={createForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuario (email de acceso)</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="off"
                        placeholder="correo@empresa.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.users.password_optional_label")}</FormLabel>
                    <FormControl>
                      <PasswordInputWithToggle
                        autoComplete="new-password"
                        placeholder={t("admin.users.password_optional_ph")}
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">{t("admin.users.password_optional_help")}</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="WORKER">Trabajador</SelectItem>
                        <SelectItem value="ADMIN">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Usuario activo</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Si está desactivado, no podrá iniciar sesión.
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Dar de alta</Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit((v) => onSubmitEdit(v))}
              className="space-y-4"
            >
              <FormField
                control={editForm.control}
                name="companyWorkerId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t("admin.users.edit_worker_label")}</FormLabel>
                    <p className="text-xs text-muted-foreground mb-1.5">
                      {watchedEditRole === "ADMIN"
                        ? t("admin.users.edit_worker_help_admin")
                        : t("admin.users.edit_worker_help_worker")}
                    </p>
                    <Popover open={workerComboOpen} onOpenChange={setWorkerComboOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={workerComboOpen}
                            disabled={selectableWorkersForEdit.length === 0 && watchedEditRole !== "ADMIN"}
                            className={cn(
                              "w-full justify-between font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                              ? (() => {
                                  const w = selectableWorkersForEdit.find((x) => x.id === field.value);
                                  return w
                                    ? `${companyWorkerDisplayName(w)} · ${w.dni}`
                                    : t("admin.users.worker_pick_placeholder");
                                })()
                              : t("admin.users.worker_pick_placeholder")}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[min(calc(100vw-2rem),32rem)]" align="start">
                        <Command>
                          <CommandInput placeholder={t("admin.users.worker_search_ph")} />
                          <CommandList>
                            <CommandEmpty>{t("admin.users.worker_search_empty")}</CommandEmpty>
                            <CommandGroup>
                              {watchedEditRole === "WORKER" ? (
                                <CommandItem
                                  value="__clear__ sin seleccionar"
                                  onSelect={() => {
                                    field.onChange("");
                                    setWorkerComboOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      !field.value ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {t("admin.users.worker_clear_choice")}
                                </CommandItem>
                              ) : null}
                              {selectableWorkersForEdit.map((w) => (
                                <CommandItem
                                  key={w.id}
                                  value={workerSearchValue(w)}
                                  onSelect={() => {
                                    field.onChange(w.id);
                                    if (w.email.trim()) {
                                      editForm.setValue("email", w.email.trim().toLowerCase());
                                    }
                                    setWorkerComboOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === w.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {companyWorkerDisplayName(w)} · {w.dni}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {selectableWorkersForEdit.length === 0 && watchedEditRole === "ADMIN" ? (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        {t("admin.users.edit_worker_none_available")}
                      </p>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedEditWorker ? (
                <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground space-y-1">
                  <p>
                    <span className="font-medium text-foreground">{t("admin.users.preview_city")}</span>{" "}
                    {selectedEditWorker.city}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">{t("admin.users.preview_employment")}</span>{" "}
                    {COMPANY_WORKER_EMPLOYMENT_LABELS[selectedEditWorker.employmentType]}
                  </p>
                </div>
              ) : null}

              {initial && (
                <div className="rounded-lg border bg-muted/30 px-3 py-3 text-sm space-y-2">
                  <p className="font-medium text-foreground">{t("admin.users.password_security_title")}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("admin.users.password_not_visible")}
                  </p>
                  <div className="flex flex-wrap gap-2 items-center text-xs">
                    {initial.mustChangePassword ? (
                      <Badge
                        variant="outline"
                        className="font-normal border-amber-600/50 text-amber-900 dark:text-amber-200"
                      >
                        {t("admin.users.must_change_badge")}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">
                        {t("admin.users.last_password_change")}:{" "}
                        <span className="text-foreground font-medium">
                          {formatShortDate(initial.passwordChangedAt)}
                        </span>
                      </span>
                    )}
                  </div>
                  {!initial.mustChangePassword && initial.passwordChangedAt ? (() => {
                    const deadline = nextPasswordRenewalDeadline(initial.passwordChangedAt);
                    if (!deadline) return null;
                    const overdue = deadline.getTime() < Date.now();
                    return (
                      <p
                        className={
                          overdue ? "text-xs text-destructive" : "text-xs text-muted-foreground"
                        }
                      >
                        {overdue
                          ? t("admin.users.renewal_overdue")
                          : `${t("admin.users.renewal_due")} ${formatShortDate(deadline.toISOString())}`}
                      </p>
                    );
                  })() : null}
                </div>
              )}

              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuario (email de acceso)</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nueva contraseña (opcional)</FormLabel>
                    <FormControl>
                      <PasswordInputWithToggle
                        autoComplete="new-password"
                        placeholder="Dejar vacío para no cambiar"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="WORKER">Trabajador</SelectItem>
                        <SelectItem value="ADMIN">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Usuario activo</FormLabel>
                      <p className="text-xs text-muted-foreground">Baja lógica si está desactivado.</p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Guardar cambios</Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function UserFormDialog(props: Props) {
  const { language } = useLanguage();
  return <UserFormDialogInner key={language} {...props} />;
}
