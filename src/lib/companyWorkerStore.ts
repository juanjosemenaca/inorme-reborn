import type {
  AutonomoVia,
  CompanyWorkerEmploymentType,
  CompanyWorkerRecord,
} from "@/types/companyWorkers";
import { getProviderById } from "@/lib/providerStore";

const STORAGE_KEY = "inorme_company_workers_db_v1";

let listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeCompanyWorkers(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let snapshotCache: CompanyWorkerRecord[] | null = null;
let snapshotRawKey: string | null = null;

function saveAll(rows: CompanyWorkerRecord[]) {
  const serialized = JSON.stringify(rows);
  localStorage.setItem(STORAGE_KEY, serialized);
  snapshotRawKey = serialized;
  snapshotCache = rows;
  emit();
}

function migrateRecord(w: CompanyWorkerRecord): CompanyWorkerRecord {
  return {
    ...w,
    providerId: w.providerId ?? null,
    autonomoVia: w.autonomoVia ?? null,
  };
}

function loadRaw(): CompanyWorkerRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CompanyWorkerRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(migrateRecord);
  } catch {
    return [];
  }
}

function seedIfEmpty(): void {
  const rows = loadRaw();
  if (rows.length > 0) return;

  const now = new Date().toISOString();
  const demo: CompanyWorkerRecord = {
    id: "cw-seed-1",
    firstName: "Luis",
    lastName: "Fernández",
    dni: "44445555K",
    email: "luis.fernandez@ejemplo.local",
    mobile: "+34 622 000 000",
    postalAddress: "Calle Mayor 5, 4º B",
    city: "Madrid",
    employmentType: "FIJO",
    providerId: null,
    autonomoVia: null,
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  saveAll([demo]);
}

export function ensureCompanyWorkersSeeded(): void {
  seedIfEmpty();
}

export function getCompanyWorkersSnapshot(): CompanyWorkerRecord[] {
  ensureCompanyWorkersSeeded();
  const raw = localStorage.getItem(STORAGE_KEY) ?? "";
  if (raw === snapshotRawKey && snapshotCache) {
    return snapshotCache;
  }
  const list = loadRaw();
  snapshotRawKey = raw;
  snapshotCache = list;
  return snapshotCache;
}

export function getCompanyWorkerById(id: string): CompanyWorkerRecord | undefined {
  return getCompanyWorkersSnapshot().find((w) => w.id === id);
}

function normalizeEmploymentFields(
  employmentType: CompanyWorkerEmploymentType,
  providerId: string | null | undefined,
  autonomoVia: AutonomoVia | null | undefined
): { providerId: string | null; autonomoVia: AutonomoVia | null } {
  if (employmentType === "FIJO" || employmentType === "TEMPORAL" || employmentType === "PRACTICAS") {
    return { providerId: null, autonomoVia: null };
  }
  if (employmentType === "SUBCONTRATADO") {
    const pid = (providerId ?? "").trim();
    if (!pid) throw new Error("Indica el proveedor (empresa) del subcontratado.");
    const p = getProviderById(pid);
    if (!p || !p.active) throw new Error("El proveedor seleccionado no existe o está inactivo.");
    return { providerId: pid, autonomoVia: null };
  }
  if (employmentType === "AUTONOMO") {
    const via = autonomoVia ?? null;
    if (!via) throw new Error("Indica si el autónomo es por cuenta propia o por empresa.");
    if (via === "CUENTA_PROPIA") {
      return { providerId: null, autonomoVia: "CUENTA_PROPIA" };
    }
    const pid = (providerId ?? "").trim();
    if (!pid) throw new Error("Indica la empresa (proveedor) a la que está vinculado el autónomo.");
    const p = getProviderById(pid);
    if (!p || !p.active) throw new Error("El proveedor seleccionado no existe o está inactivo.");
    return { providerId: pid, autonomoVia: "EMPRESA" };
  }
  return { providerId: null, autonomoVia: null };
}

export type CreateCompanyWorkerInput = {
  firstName: string;
  lastName: string;
  dni: string;
  email: string;
  mobile: string;
  postalAddress: string;
  city: string;
  employmentType: CompanyWorkerEmploymentType;
  providerId?: string | null;
  autonomoVia?: AutonomoVia | null;
  active: boolean;
};

export function createCompanyWorker(input: CreateCompanyWorkerInput): CompanyWorkerRecord {
  const rows = loadRaw();
  const dniNorm = input.dni.trim().toUpperCase();
  if (rows.some((w) => w.dni.replace(/\s/g, "") === dniNorm.replace(/\s/g, ""))) {
    throw new Error("Ya existe una persona con ese DNI/NIE.");
  }
  const { providerId, autonomoVia } = normalizeEmploymentFields(
    input.employmentType,
    input.providerId,
    input.autonomoVia
  );

  const now = new Date().toISOString();
  const record: CompanyWorkerRecord = {
    id: `cw-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    dni: dniNorm,
    email: input.email.trim().toLowerCase(),
    mobile: input.mobile.trim(),
    postalAddress: input.postalAddress.trim(),
    city: input.city.trim(),
    employmentType: input.employmentType,
    providerId,
    autonomoVia,
    active: input.active,
    createdAt: now,
    updatedAt: now,
  };
  rows.push(record);
  saveAll(rows);
  return record;
}

export type UpdateCompanyWorkerInput = Partial<CreateCompanyWorkerInput>;

export function updateCompanyWorker(id: string, input: UpdateCompanyWorkerInput): CompanyWorkerRecord {
  const rows = loadRaw();
  const idx = rows.findIndex((w) => w.id === id);
  if (idx === -1) throw new Error("Trabajador no encontrado.");

  const current = rows[idx];
  const nextDni = input.dni !== undefined ? input.dni.trim().toUpperCase() : current.dni;
  const dniConflict = rows.some(
    (w, i) => i !== idx && w.dni.replace(/\s/g, "") === nextDni.replace(/\s/g, "")
  );
  if (dniConflict) throw new Error("Ya existe otra persona con ese DNI/NIE.");

  const nextType = input.employmentType ?? current.employmentType;
  const { providerId, autonomoVia } = normalizeEmploymentFields(
    nextType,
    input.providerId !== undefined ? input.providerId : current.providerId,
    input.autonomoVia !== undefined ? input.autonomoVia : current.autonomoVia
  );

  const next: CompanyWorkerRecord = {
    ...current,
    firstName: input.firstName !== undefined ? input.firstName.trim() : current.firstName,
    lastName: input.lastName !== undefined ? input.lastName.trim() : current.lastName,
    dni: nextDni,
    email: input.email !== undefined ? input.email.trim().toLowerCase() : current.email,
    mobile: input.mobile !== undefined ? input.mobile.trim() : current.mobile,
    postalAddress:
      input.postalAddress !== undefined ? input.postalAddress.trim() : current.postalAddress,
    city: input.city !== undefined ? input.city.trim() : current.city,
    employmentType: nextType,
    providerId,
    autonomoVia,
    active: input.active !== undefined ? input.active : current.active,
    updatedAt: new Date().toISOString(),
  };

  rows[idx] = next;
  saveAll(rows);
  return next;
}

export function deleteCompanyWorker(id: string): void {
  const rows = loadRaw().filter((w) => w.id !== id);
  saveAll(rows);
}

/** Al eliminar un proveedor, quitar la vinculación en trabajadores (p. ej. desde la UI). */
export function clearProviderLinksFromWorkers(providerId: string): void {
  const rows = loadRaw();
  let changed = false;
  const next = rows.map((w) => {
    if (w.providerId === providerId) {
      changed = true;
      return { ...w, providerId: null, updatedAt: new Date().toISOString() };
    }
    return w;
  });
  if (changed) saveAll(next);
}
