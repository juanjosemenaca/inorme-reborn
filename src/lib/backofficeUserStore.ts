import type { BackofficeUserRecord, EmploymentType, UserRole } from "@/types/backoffice";
import { getDisplayName } from "@/types/backoffice";
import type { CompanyWorkerRecord } from "@/types/companyWorkers";
import { companyWorkerDisplayName } from "@/types/companyWorkers";
import { getCompanyWorkerById } from "@/lib/companyWorkerStore";

const STORAGE_KEY = "inorme_backoffice_user_db_v2";

let listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeUsers(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function migrateRecord(u: BackofficeUserRecord): BackofficeUserRecord {
  return {
    ...u,
    companyWorkerId: u.companyWorkerId ?? null,
    city: u.city ?? "",
    employmentType: (u.employmentType ?? "FIJO") as EmploymentType,
  };
}

/** Lectura directa desde localStorage (mutaciones: create/update/delete). */
function loadRaw(): BackofficeUserRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BackofficeUserRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(migrateRecord);
  } catch {
    return [];
  }
}

let snapshotCache: BackofficeUserRecord[] | null = null;
let snapshotRawKey: string | null = null;

function saveRaw(users: BackofficeUserRecord[]) {
  const serialized = JSON.stringify(users);
  localStorage.setItem(STORAGE_KEY, serialized);
  snapshotRawKey = serialized;
  snapshotCache = users;
  emit();
}

function denormalizeFromWorker(w: CompanyWorkerRecord): Pick<
  BackofficeUserRecord,
  "firstName" | "lastName" | "dni" | "mobile" | "postalAddress" | "city" | "employmentType"
> {
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

/** Nombre mostrado: prioriza ficha de trabajador vinculada. */
export function getResolvedDisplayName(u: BackofficeUserRecord): string {
  if (u.companyWorkerId) {
    const w = getCompanyWorkerById(u.companyWorkerId);
    if (w) return companyWorkerDisplayName(w);
  }
  return getDisplayName(u);
}

export function isCompanyWorkerLinkedToUser(
  companyWorkerId: string,
  excludeUserId?: string
): boolean {
  return loadRaw().some(
    (x) => x.companyWorkerId === companyWorkerId && x.id !== excludeUserId
  );
}

export function hasUsersLinkedToCompanyWorker(companyWorkerId: string): boolean {
  return loadRaw().some((u) => u.companyWorkerId === companyWorkerId);
}

function seedIfEmpty(): void {
  const users = loadRaw();
  if (users.length > 0) return;

  const now = new Date().toISOString();
  const seedAdmin: BackofficeUserRecord = {
    id: "u-admin-seed",
    email: "admin@inorme.com",
    password: "AdminInorme2025!",
    role: "ADMIN",
    companyWorkerId: null,
    firstName: "Administrador",
    lastName: "Inorme",
    dni: "00000000A",
    mobile: "+34 600 000 000",
    postalAddress: "Madrid, España",
    city: "Madrid",
    employmentType: "FIJO",
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  const seedWorker: BackofficeUserRecord = {
    id: "u-worker-seed",
    email: "trabajador@inorme.com",
    password: "Trabajador2025!",
    role: "WORKER",
    companyWorkerId: null,
    firstName: "María",
    lastName: "García López",
    dni: "12345678Z",
    mobile: "+34 611 222 333",
    postalAddress: "Calle Ejemplo 1, 28001 Madrid",
    city: "Madrid",
    employmentType: "FIJO",
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  saveRaw([seedAdmin, seedWorker]);
}

export function ensureBackofficeUsersSeeded(): void {
  seedIfEmpty();
}

export function getUsersSnapshot(): BackofficeUserRecord[] {
  ensureBackofficeUsersSeeded();
  const raw = localStorage.getItem(STORAGE_KEY) ?? "";
  if (raw === snapshotRawKey && snapshotCache) {
    return snapshotCache;
  }
  const users = loadRaw();
  snapshotRawKey = raw;
  snapshotCache = users;
  return snapshotCache;
}

export function getAllUsers(): BackofficeUserRecord[] {
  return getUsersSnapshot();
}

export function getUserById(id: string): BackofficeUserRecord | undefined {
  return getUsersSnapshot().find((u) => u.id === id);
}

export function authenticate(
  email: string,
  password: string
): BackofficeUserRecord | undefined {
  ensureBackofficeUsersSeeded();
  const normalized = email.trim().toLowerCase();
  return loadRaw().find(
    (u) =>
      u.email.toLowerCase() === normalized &&
      u.password === password &&
      u.active
  );
}

export type CreateUserInput = {
  companyWorkerId: string;
  email: string;
  password: string;
  role: UserRole;
  active: boolean;
};

export function createUser(input: CreateUserInput): BackofficeUserRecord {
  const users = loadRaw();
  const worker = getCompanyWorkerById(input.companyWorkerId);
  if (!worker) throw new Error("Trabajador no encontrado.");
  if (!worker.active) throw new Error("Activa primero la ficha del trabajador en Trabajadores.");

  if (users.some((u) => u.companyWorkerId === worker.id)) {
    throw new Error("Ese trabajador ya tiene un usuario de acceso.");
  }

  const emailNorm = input.email.trim().toLowerCase();
  if (users.some((u) => u.email.toLowerCase() === emailNorm)) {
    throw new Error("Ya existe un usuario con ese email.");
  }

  const now = new Date().toISOString();
  const fromWorker = denormalizeFromWorker(worker);

  const record: BackofficeUserRecord = {
    id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    email: emailNorm,
    password: input.password,
    role: input.role,
    companyWorkerId: worker.id,
    ...fromWorker,
    active: input.active,
    createdAt: now,
    updatedAt: now,
  };
  users.push(record);
  saveRaw(users);
  return record;
}

export type UpdateUserInput = {
  email?: string;
  password?: string;
  role?: UserRole;
  active?: boolean;
};

export function updateUser(id: string, input: UpdateUserInput): BackofficeUserRecord {
  const users = loadRaw();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) throw new Error("Usuario no encontrado.");

  const current = users[idx];

  const emailChanged =
    input.email !== undefined && input.email.trim().toLowerCase() !== current.email.toLowerCase();
  if (emailChanged) {
    const taken = users.some(
      (u, i) =>
        i !== idx && u.email.toLowerCase() === input.email!.trim().toLowerCase()
    );
    if (taken) throw new Error("Ya existe otro usuario con ese email.");
  }

  let merged: BackofficeUserRecord = {
    ...current,
    email: input.email !== undefined ? input.email.trim().toLowerCase() : current.email,
    role: input.role ?? current.role,
    active: input.active !== undefined ? input.active : current.active,
    password:
      input.password !== undefined && input.password.length > 0
        ? input.password
        : current.password,
    updatedAt: new Date().toISOString(),
  };

  if (merged.companyWorkerId) {
    const w = getCompanyWorkerById(merged.companyWorkerId);
    if (w) {
      merged = {
        ...merged,
        ...denormalizeFromWorker(w),
      };
    }
  }

  users[idx] = merged;
  saveRaw(users);
  return merged;
}

export function deleteUser(id: string): void {
  const users = loadRaw();
  const admins = users.filter((u) => u.role === "ADMIN");
  const target = users.find((u) => u.id === id);
  if (!target) throw new Error("Usuario no encontrado.");
  if (admins.length === 1 && target.role === "ADMIN") {
    throw new Error("No puedes eliminar el único administrador.");
  }
  saveRaw(users.filter((u) => u.id !== id));
}

export function countAdmins(): number {
  return loadRaw().filter((u) => u.role === "ADMIN").length;
}
