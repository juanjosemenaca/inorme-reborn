import type { ClientContactPerson } from "@/types/clients";
import type { ProviderRecord } from "@/types/providers";

const STORAGE_KEY = "inorme_providers_db_v1";

let listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeProviders(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let snapshotCache: ProviderRecord[] | null = null;
let snapshotRawKey: string | null = null;

function saveAll(rows: ProviderRecord[]) {
  const serialized = JSON.stringify(rows);
  localStorage.setItem(STORAGE_KEY, serialized);
  snapshotRawKey = serialized;
  snapshotCache = rows;
  emit();
}

function migrateRecord(p: ProviderRecord): ProviderRecord {
  return {
    ...p,
    contacts: Array.isArray(p.contacts) ? p.contacts : [],
  };
}

function loadRaw(): ProviderRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProviderRecord[];
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
  const demo: ProviderRecord = {
    id: "p-seed-1",
    tradeName: "Servicios Integrales Sur",
    companyName: "Servicios Integrales Sur S.L.",
    cif: "B99887766",
    fiscalAddress: "Calle Industria 20, 41002 Sevilla",
    phone: "+34 955 111 222",
    contactEmail: "admin@serviciossur.es",
    notes: "Proveedor de ejemplo para subcontratados o autónomos por empresa.",
    active: true,
    contacts: [],
    createdAt: now,
    updatedAt: now,
  };

  saveAll([demo]);
}

export function ensureProvidersSeeded(): void {
  seedIfEmpty();
}

export function getProvidersSnapshot(): ProviderRecord[] {
  ensureProvidersSeeded();
  const raw = localStorage.getItem(STORAGE_KEY) ?? "";
  if (raw === snapshotRawKey && snapshotCache) {
    return snapshotCache;
  }
  const list = loadRaw();
  snapshotRawKey = raw;
  snapshotCache = list;
  return snapshotCache;
}

export function getProviderById(id: string): ProviderRecord | undefined {
  return getProvidersSnapshot().find((p) => p.id === id);
}

export type CreateProviderInput = {
  tradeName: string;
  companyName: string;
  cif: string;
  fiscalAddress: string;
  phone: string;
  contactEmail: string;
  notes: string;
  active: boolean;
};

export function createProvider(input: CreateProviderInput): ProviderRecord {
  const rows = loadRaw();
  const cifNorm = input.cif.trim().toUpperCase();
  if (rows.some((p) => p.cif.replace(/\s/g, "") === cifNorm.replace(/\s/g, ""))) {
    throw new Error("Ya existe un proveedor con ese CIF.");
  }
  const now = new Date().toISOString();
  const record: ProviderRecord = {
    id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    tradeName: input.tradeName.trim(),
    companyName: input.companyName.trim(),
    cif: cifNorm,
    fiscalAddress: input.fiscalAddress.trim(),
    phone: input.phone.trim(),
    contactEmail: input.contactEmail.trim().toLowerCase(),
    notes: input.notes.trim(),
    active: input.active,
    contacts: [],
    createdAt: now,
    updatedAt: now,
  };
  rows.push(record);
  saveAll(rows);
  return record;
}

export type UpdateProviderInput = Partial<CreateProviderInput>;

export function updateProvider(id: string, input: UpdateProviderInput): ProviderRecord {
  const rows = loadRaw();
  const idx = rows.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error("Proveedor no encontrado.");

  const current = rows[idx];
  const nextCif = input.cif !== undefined ? input.cif.trim().toUpperCase() : current.cif;
  const conflict = rows.some(
    (p, i) => i !== idx && p.cif.replace(/\s/g, "") === nextCif.replace(/\s/g, "")
  );
  if (conflict) throw new Error("Ya existe otro proveedor con ese CIF.");

  const next: ProviderRecord = {
    ...current,
    tradeName: input.tradeName !== undefined ? input.tradeName.trim() : current.tradeName,
    companyName: input.companyName !== undefined ? input.companyName.trim() : current.companyName,
    cif: nextCif,
    fiscalAddress:
      input.fiscalAddress !== undefined ? input.fiscalAddress.trim() : current.fiscalAddress,
    phone: input.phone !== undefined ? input.phone.trim() : current.phone,
    contactEmail:
      input.contactEmail !== undefined
        ? input.contactEmail.trim().toLowerCase()
        : current.contactEmail,
    notes: input.notes !== undefined ? input.notes.trim() : current.notes,
    active: input.active !== undefined ? input.active : current.active,
    updatedAt: new Date().toISOString(),
  };

  rows[idx] = next;
  saveAll(rows);
  return next;
}

export function deleteProvider(id: string): void {
  const rows = loadRaw().filter((p) => p.id !== id);
  saveAll(rows);
}

export type CreateContactInput = Omit<ClientContactPerson, "id">;

export function addProviderContact(
  providerId: string,
  input: CreateContactInput
): ClientContactPerson {
  const rows = loadRaw();
  const idx = rows.findIndex((p) => p.id === providerId);
  if (idx === -1) throw new Error("Proveedor no encontrado.");

  const contact: ClientContactPerson = {
    id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    mobile: input.mobile.trim(),
    position: input.position.trim(),
    description: input.description.trim(),
  };

  rows[idx] = {
    ...rows[idx],
    contacts: [...rows[idx].contacts, contact],
    updatedAt: new Date().toISOString(),
  };
  saveAll(rows);
  return contact;
}

export function updateProviderContact(
  providerId: string,
  contactId: string,
  input: Partial<CreateContactInput>
): ClientContactPerson {
  const rows = loadRaw();
  const pIdx = rows.findIndex((p) => p.id === providerId);
  if (pIdx === -1) throw new Error("Proveedor no encontrado.");

  const contacts = rows[pIdx].contacts.map((p) => {
    if (p.id !== contactId) return p;
    return {
      ...p,
      firstName: input.firstName !== undefined ? input.firstName.trim() : p.firstName,
      lastName: input.lastName !== undefined ? input.lastName.trim() : p.lastName,
      email: input.email !== undefined ? input.email.trim().toLowerCase() : p.email,
      mobile: input.mobile !== undefined ? input.mobile.trim() : p.mobile,
      position: input.position !== undefined ? input.position.trim() : p.position,
      description: input.description !== undefined ? input.description.trim() : p.description,
    };
  });

  if (!contacts.some((p) => p.id === contactId)) throw new Error("Contacto no encontrado.");

  rows[pIdx] = {
    ...rows[pIdx],
    contacts,
    updatedAt: new Date().toISOString(),
  };
  saveAll(rows);
  return contacts.find((p) => p.id === contactId)!;
}

export function removeProviderContact(providerId: string, contactId: string): void {
  const rows = loadRaw();
  const pIdx = rows.findIndex((p) => p.id === providerId);
  if (pIdx === -1) throw new Error("Proveedor no encontrado.");

  rows[pIdx] = {
    ...rows[pIdx],
    contacts: rows[pIdx].contacts.filter((p) => p.id !== contactId),
    updatedAt: new Date().toISOString(),
  };
  saveAll(rows);
}
