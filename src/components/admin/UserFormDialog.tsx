import { useEffect, useMemo } from "react";
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const NONE_WORKER = "__none__";
const roleEnum = z.enum(["ADMIN", "WORKER"]);

const createSchema = z.object({
  companyWorkerId: z.string().min(1, "Elige un trabajador"),
  email: z.string().email("Email no válido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  role: roleEnum,
  active: z.boolean(),
});

const editSchema = z.object({
  email: z.string().email("Email no válido"),
  password: z
    .string()
    .optional()
    .refine((v) => !v || v.length >= 8, "Mínimo 8 caracteres si cambias la contraseña"),
  role: roleEnum,
  active: z.boolean(),
});

export type UserCreateFormValues = z.infer<typeof createSchema>;
export type UserEditFormValues = z.infer<typeof editSchema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: BackofficeUserRecord | null;
  /** Trabajadores que pueden recibir usuario (activos y aún sin cuenta) */
  selectableWorkers: CompanyWorkerRecord[];
  /** Ficha de trabajador vinculada al editar (si existe) */
  linkedWorker?: CompanyWorkerRecord | null;
  onSubmitCreate: (values: UserCreateFormValues) => void;
  onSubmitEdit: (values: UserEditFormValues) => void;
};

export function UserFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
  selectableWorkers,
  linkedWorker,
  onSubmitCreate,
  onSubmitEdit,
}: Props) {
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
    },
  });

  const watchedWorkerId = createForm.watch("companyWorkerId");
  const selectedWorker = useMemo(
    () => selectableWorkers.find((w) => w.id === watchedWorkerId),
    [selectableWorkers, watchedWorkerId]
  );

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initial) {
      editForm.reset({
        email: initial.email,
        password: "",
        role: initial.role,
        active: initial.active,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Elige la ficha del trabajador, define el email de acceso (por defecto el de la ficha), la contraseña y el rol."
              : "Credenciales y rol. Los datos personales se toman de la ficha en Trabajadores (se actualizan al guardar)."}
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
                  <FormItem>
                    <FormLabel>Trabajador</FormLabel>
                    <Select
                      value={field.value ? field.value : NONE_WORKER}
                      onValueChange={(v) => {
                        const id = v === NONE_WORKER ? "" : v;
                        field.onChange(id);
                        const w = selectableWorkers.find((x) => x.id === id);
                        if (w?.email) {
                          createForm.setValue("email", w.email.trim().toLowerCase());
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una ficha…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_WORKER}>— Seleccionar —</SelectItem>
                        {selectableWorkers.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {companyWorkerDisplayName(w)} · {w.dni}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
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
              {linkedWorker ? (
                <div className="rounded-lg border bg-muted/40 px-3 py-3 text-sm space-y-1">
                  <p className="font-medium text-foreground">
                    {companyWorkerDisplayName(linkedWorker)}
                  </p>
                  <p className="text-muted-foreground">DNI: {linkedWorker.dni}</p>
                  <p className="text-xs text-muted-foreground">
                    Datos personales en Administración → Trabajadores.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                  Usuario sin ficha de trabajador vinculada (cuenta anterior). Puedes seguir
                  editando email y rol.
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
                      <Input
                        type="password"
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
