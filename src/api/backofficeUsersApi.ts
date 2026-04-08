import { requireSupabase } from "@/api/supabaseRequire";
import { getCompanyWorkerById } from "@/api/companyWorkersApi";
import { createMemorySupabaseClient } from "@/lib/supabaseMemoryClient";
import { generateInitialPassword } from "@/lib/passwordPolicy";
import { backofficeUserRowToDomain } from "@/lib/supabase/mappers";
import type { BackofficeUserRow } from "@/types/database";
import {
  ALL_WORKER_MODULES,
  type BackofficeUserRecord,
  type EmploymentType,
  type UserRole,
  type WorkerModuleKey,
} from "@/types/backoffice";
import { getDisplayName } from "@/types/backoffice";
import type { CompanyWorkerRecord } from "@/types/companyWorkers";

function denormalizeFromWorker(w: CompanyWorkerRecord): {
  firstName: string;
  lastName: string;
  dni: string;
  mobile: string;
  postalAddress: string;
  city: string;
  employmentType: EmploymentType;
} {
  return {
    firstName: w.firstName,
    lastName: w.lastName,
    dni: w.dni,
    mobile: w.mobile,
    postalAddress: w.postalAddress,
    city: w.city,
    employmentType: w.employmentType as EmploymentType,
  };
}

export async function fetchBackofficeUsers(): Promise<BackofficeUserRecord[]> {
  const sb = requireSupabase();
  const { data: rows, error } = await sb
    .from("backoffice_users")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (rows ?? []).map((row) => backofficeUserRowToDomain(row as BackofficeUserRow));
}

export async function getUserById(id: string): Promise<BackofficeUserRecord | undefined> {
  const all = await fetchBackofficeUsers();
  return all.find((u) => u.id === id);
}

export async function getProfileByAuthUserId(authUserId: string): Promise<BackofficeUserRecord | undefined> {
  const sb = requireSupabase();
  const { data: row, error } = await sb
    .from("backoffice_users")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw error;
  return row ? backofficeUserRowToDomain(row as BackofficeUserRow) : undefined;
}

/**
 * Resuelve el perfil backoffice para la sesión Auth.
 * Si no hay fila por `auth_user_id` pero existe una con el mismo `email` y `auth_user_id` NULL,
 * enlaza automáticamente (primer acceso tras crear usuario en Auth + fila manual en SQL).
 */
export async function resolveProfileForSession(
  authUserId: string,
  email: string
): Promise<BackofficeUserRecord | undefined> {
  const sb = requireSupabase();
  const byAuth = await getProfileByAuthUserId(authUserId);
  if (byAuth) return byAuth;

  const emailNorm = email.trim().toLowerCase();
  if (!emailNorm) return undefined;

  const { data: byEmailRow, error } = await sb
    .from("backoffice_users")
    .select("*")
    .eq("email", emailNorm)
    .maybeSingle();
  if (error) throw error;
  if (!byEmailRow) return undefined;

  const row = byEmailRow as BackofficeUserRow;
  if (row.auth_user_id && row.auth_user_id !== authUserId) {
    return undefined;
  }
  if (!row.auth_user_id) {
    const { error: upErr } = await sb
      .from("backoffice_users")
      .update({ auth_user_id: authUserId })
      .eq("id", row.id);
    if (upErr) throw upErr;
  }
  const { data: fresh, error: fErr } = await sb
    .from("backoffice_users")
    .select("*")
    .eq("id", row.id)
    .single();
  if (fErr) throw fErr;
  return fresh ? backofficeUserRowToDomain(fresh as BackofficeUserRow) : undefined;
}

export async function isCompanyWorkerLinkedToUser(
  companyWorkerId: string,
  excludeUserId?: string
): Promise<boolean> {
  const users = await fetchBackofficeUsers();
  return users.some((x) => x.companyWorkerId === companyWorkerId && x.id !== excludeUserId);
}

export async function hasUsersLinkedToCompanyWorker(companyWorkerId: string): Promise<boolean> {
  const users = await fetchBackofficeUsers();
  return users.some((u) => u.companyWorkerId === companyWorkerId);
}

export async function countAdmins(): Promise<number> {
  const users = await fetchBackofficeUsers();
  return users.filter((u) => u.role === "ADMIN").length;
}

export type CreateUserInput = {
  companyWorkerId: string;
  email: string;
  /** Si viene vacío, se genera una contraseña temporal (se devuelve en la respuesta). */
  password: string;
  role: UserRole;
  active: boolean;
  enabledModules?: WorkerModuleKey[];
};

export type CreateUserResult = {
  user: BackofficeUserRecord;
  /** Contraseña inicial (solo esta vez; el usuario debe cambiarla al primer acceso). */
  initialPassword: string;
};

export async function createUser(input: CreateUserInput): Promise<CreateUserResult> {
  const sb = requireSupabase();
  const all = await fetchBackofficeUsers();
  const worker = await getCompanyWorkerById(input.companyWorkerId);
  if (!worker) throw new Error("Trabajador no encontrado.");
  if (!worker.active) throw new Error("Activa primero la ficha del trabajador en Trabajadores.");
  if (all.some((u) => u.companyWorkerId === worker.id)) {
    throw new Error("Ese trabajador ya tiene un usuario de acceso.");
  }
  const emailNorm = input.email.trim().toLowerCase();
  if (all.some((u) => u.email.toLowerCase() === emailNorm)) {
    throw new Error("Ya existe un usuario con ese email.");
  }

  const initialPassword =
    input.password.trim().length >= 8 ? input.password.trim() : generateInitialPassword();

  const mem = createMemorySupabaseClient();
  const { data: authData, error: authErr } = await mem.auth.signUp({
    email: emailNorm,
    password: initialPassword,
  });
  if (authErr) throw new Error(authErr.message);
  if (!authData.user) throw new Error("No se pudo crear el usuario de acceso.");
  await mem.auth.signOut();

  const fromWorker = denormalizeFromWorker(worker);
  const insertRow = {
    email: emailNorm,
    role: input.role,
    company_worker_id: worker.id,
    first_name: fromWorker.firstName,
    last_name: fromWorker.lastName,
    dni: fromWorker.dni,
    mobile: fromWorker.mobile,
    postal_address: fromWorker.postalAddress,
    city: fromWorker.city,
    employment_type: fromWorker.employmentType,
    active: input.active,
    enabled_modules: input.enabledModules ?? [...ALL_WORKER_MODULES],
    auth_user_id: authData.user.id,
    must_change_password: true,
    password_changed_at: null as string | null,
  };

  const { data: inserted, error } = await sb.from("backoffice_users").insert(insertRow).select("*").single();
  if (error) throw error;
  return {
    user: backofficeUserRowToDomain(inserted as BackofficeUserRow),
    initialPassword,
  };
}

/** Contraseña inicial por defecto para altas masivas (el usuario debe cambiarla al primer acceso). */
export const DEFAULT_BULK_INITIAL_PASSWORD = "12345678";

export type BulkCreateUsersResult = {
  success: { email: string; name: string }[];
  failed: { companyWorkerId: string; email: string; name: string; message: string }[];
  initialPassword: string;
};

/**
 * Crea varios usuarios de backoffice para fichas de trabajador sin cuenta.
 * Se procesa en serie para mantener coherencia con la lista de usuarios existentes.
 */
export async function bulkCreateUsersFromWorkers(
  companyWorkerIds: string[],
  options?: { password?: string; role?: UserRole; active?: boolean }
): Promise<BulkCreateUsersResult> {
  const password = (options?.password ?? DEFAULT_BULK_INITIAL_PASSWORD).trim();
  if (password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }
  const role = options?.role ?? "WORKER";
  const active = options?.active ?? true;
  const success: BulkCreateUsersResult["success"] = [];
  const failed: BulkCreateUsersResult["failed"] = [];
  const emailsInBatch = new Set<string>();

  for (const id of companyWorkerIds) {
    let worker: CompanyWorkerRecord | undefined;
    try {
      worker = await getCompanyWorkerById(id);
      if (!worker) {
        failed.push({
          companyWorkerId: id,
          email: "",
          name: "",
          message: "Trabajador no encontrado.",
        });
        continue;
      }
      const name = getDisplayName(worker);
      if (!worker.active) {
        failed.push({
          companyWorkerId: id,
          email: worker.email,
          name,
          message: "La ficha del trabajador está inactiva.",
        });
        continue;
      }
      const emailNorm = worker.email.trim().toLowerCase();
      if (!emailNorm) {
        failed.push({
          companyWorkerId: id,
          email: "",
          name,
          message: "La ficha no tiene email; complétalo en Trabajadores.",
        });
        continue;
      }
      if (emailsInBatch.has(emailNorm)) {
        failed.push({
          companyWorkerId: id,
          email: emailNorm,
          name,
          message: "Email duplicado en la selección.",
        });
        continue;
      }
      emailsInBatch.add(emailNorm);
      const result = await createUser({
        companyWorkerId: id,
        email: emailNorm,
        password,
        role,
        active,
      });
      success.push({
        email: result.user.email,
        name: getDisplayName(result.user),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido.";
      const w = worker ?? (await getCompanyWorkerById(id));
      failed.push({
        companyWorkerId: id,
        email: w?.email ?? "",
        name: w ? getDisplayName(w) : "",
        message: msg,
      });
    }
  }

  return { success, failed, initialPassword: password };
}

export async function completePasswordChange(newPassword: string): Promise<void> {
  const sb = requireSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sesión no válida.");
  const { error: pwErr } = await sb.auth.updateUser({ password: newPassword });
  if (pwErr) throw new Error(pwErr.message);
  const profile = await getProfileByAuthUserId(user.id);
  if (!profile) throw new Error("Perfil no encontrado.");
  const { error } = await sb
    .from("backoffice_users")
    .update({
      must_change_password: false,
      password_changed_at: new Date().toISOString(),
    })
    .eq("id", profile.id);
  if (error) throw error;
}

export type UpdateUserInput = {
  email?: string;
  password?: string;
  role?: UserRole;
  active?: boolean;
  enabledModules?: WorkerModuleKey[];
  /** Solo administradores: obligar al usuario a cambiar contraseña en el próximo acceso. */
  forcePasswordChange?: boolean;
  /** Vincular ficha de trabajador (obligatorio para rol ADMIN). */
  companyWorkerId?: string | null;
};

export async function updateUser(
  id: string,
  input: UpdateUserInput,
  options?: { isSelf?: boolean }
): Promise<BackofficeUserRecord> {
  const sb = requireSupabase();
  const users = await fetchBackofficeUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) throw new Error("Usuario no encontrado.");
  const current = users[idx];

  const emailChanged =
    input.email !== undefined && input.email.trim().toLowerCase() !== current.email.toLowerCase();
  if (emailChanged) {
    const taken = users.some(
      (u, i) => i !== idx && u.email.toLowerCase() === input.email!.trim().toLowerCase()
    );
    if (taken) throw new Error("Ya existe otro usuario con ese email.");
  }

  if (input.password !== undefined && input.password.length > 0) {
    if (options?.isSelf) {
      const { error: pwErr } = await sb.auth.updateUser({ password: input.password });
      if (pwErr) throw new Error(pwErr.message);
    } else {
      throw new Error(
        "Cambiar la contraseña de otro usuario solo desde Supabase Dashboard → Authentication → Users."
      );
    }
  }

  if (emailChanged && options?.isSelf) {
    const { error: emErr } = await sb.auth.updateUser({ email: input.email!.trim().toLowerCase() });
    if (emErr) throw new Error(emErr.message);
  }

  let merged: BackofficeUserRecord = {
    ...current,
    email: input.email !== undefined ? input.email.trim().toLowerCase() : current.email,
    role: input.role ?? current.role,
    active: input.active !== undefined ? input.active : current.active,
    enabledModules: input.enabledModules ?? current.enabledModules,
    password: current.password,
    mustChangePassword: current.mustChangePassword,
    passwordChangedAt: current.passwordChangedAt,
    updatedAt: new Date().toISOString(),
  };

  if (input.password !== undefined && input.password.length > 0 && options?.isSelf) {
    merged.mustChangePassword = false;
    merged.passwordChangedAt = new Date().toISOString();
  }

  if (input.forcePasswordChange !== undefined) {
    merged.mustChangePassword = input.forcePasswordChange;
  }

  if (input.companyWorkerId !== undefined) {
    const raw = input.companyWorkerId?.trim() ?? "";
    if (!raw) {
      merged = { ...merged, companyWorkerId: null };
    } else {
      const linkedElsewhere = await isCompanyWorkerLinkedToUser(raw, id);
      if (linkedElsewhere) {
        throw new Error("Ese trabajador ya tiene un usuario de acceso.");
      }
      const w = await getCompanyWorkerById(raw);
      if (!w) throw new Error("Trabajador no encontrado.");
      if (!w.active) throw new Error("Activa primero la ficha del trabajador en Trabajadores.");
      merged = {
        ...merged,
        companyWorkerId: w.id,
        ...denormalizeFromWorker(w),
      };
    }
  }

  if (merged.role === "ADMIN" && !merged.companyWorkerId) {
    throw new Error(
      "Un administrador debe tener una ficha de trabajador vinculada. Elige un trabajador en el formulario."
    );
  }

  if (merged.companyWorkerId && input.companyWorkerId === undefined) {
    const w = await getCompanyWorkerById(merged.companyWorkerId);
    if (w) {
      merged = {
        ...merged,
        ...denormalizeFromWorker(w),
      };
    }
  }

  const patch = {
    email: merged.email,
    role: merged.role,
    active: merged.active,
    enabled_modules: merged.enabledModules,
    company_worker_id: merged.companyWorkerId,
    first_name: merged.firstName,
    last_name: merged.lastName,
    dni: merged.dni,
    mobile: merged.mobile,
    postal_address: merged.postalAddress,
    city: merged.city,
    employment_type: merged.employmentType,
    must_change_password: merged.mustChangePassword,
    password_changed_at: merged.passwordChangedAt,
  };

  const { data: updated, error } = await sb.from("backoffice_users").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return backofficeUserRowToDomain(updated as BackofficeUserRow);
}

export async function updateWorkerModules(
  userId: string,
  enabledModules: WorkerModuleKey[]
): Promise<BackofficeUserRecord> {
  const user = await getUserById(userId);
  if (!user) throw new Error("Usuario no encontrado.");
  if (user.role !== "WORKER" && user.role !== "ADMIN") {
    throw new Error("Solo se pueden configurar módulos de usuarios trabajador o administrador.");
  }
  return updateUser(userId, { enabledModules });
}

export async function bulkUpdateWorkerModules(
  enabledModules: WorkerModuleKey[],
  target: "ALL_WORKERS" | "ONLY_ACTIVE_WORKERS" = "ALL_WORKERS"
): Promise<void> {
  const sb = requireSupabase();
  let q = sb.from("backoffice_users").update({ enabled_modules: enabledModules }).eq("role", "WORKER");
  if (target === "ONLY_ACTIVE_WORKERS") q = q.eq("active", true);
  const { error } = await q;
  if (error) throw error;
}

/**
 * Tras actualizar `company_workers`, alinea la fila en `backoffice_users` vinculada (nombre, DNI, email de ficha, etc.).
 */
export async function syncBackofficeUserFromCompanyWorker(companyWorkerId: string): Promise<void> {
  const sb = requireSupabase();
  const users = await fetchBackofficeUsers();
  const u = users.find((x) => x.companyWorkerId === companyWorkerId);
  if (!u) return;
  const w = await getCompanyWorkerById(companyWorkerId);
  if (!w) return;
  const d = denormalizeFromWorker(w);
  const { error } = await sb
    .from("backoffice_users")
    .update({
      email: w.email.trim().toLowerCase(),
      first_name: d.firstName,
      last_name: d.lastName,
      dni: d.dni,
      mobile: d.mobile,
      postal_address: d.postalAddress,
      city: d.city,
      employment_type: d.employmentType,
    })
    .eq("id", u.id);
  if (error) throw error;
}

export async function deleteUser(id: string): Promise<void> {
  const sb = requireSupabase();
  const users = await fetchBackofficeUsers();
  const admins = users.filter((u) => u.role === "ADMIN");
  const target = users.find((u) => u.id === id);
  if (!target) throw new Error("Usuario no encontrado.");
  if (admins.length === 1 && target.role === "ADMIN") {
    throw new Error("No puedes eliminar el único administrador.");
  }
  const { error } = await sb.from("backoffice_users").delete().eq("id", id);
  if (error) throw error;
}
