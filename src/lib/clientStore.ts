import type { ClientContactPerson, ClientKind, ClientRecord } from "@/types/clients";

const STORAGE_KEY = "inorme_clients_db_v1";

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeClients(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let snapshotCache: ClientRecord[] | null = null;
let snapshotRawKey: string | null = null;

function saveAll(clients: ClientRecord[]) {
  const serialized = JSON.stringify(clients);
  localStorage.setItem(STORAGE_KEY, serialized);
  snapshotRawKey = serialized;
  snapshotCache = clients;
  emit();
}

function migrateRecord(c: ClientRecord): ClientRecord {
  return {
    ...c,
    linkedFinalClientId: c.linkedFinalClientId ?? null,
    contacts: Array.isArray(c.contacts) ? c.contacts : [],
  };
}

function toNullableId(s: string | null | undefined): string | null {
  if (s === undefined || s === null) return null;
  const t = String(s).trim();
  return t === "" ? null : t;
}

function resolveLinkedFinalForCreate(
  all: ClientRecord[],
  clientKind: ClientKind,
  raw: string | null | undefined
): string | null {
  if (clientKind !== "INTERMEDIARIO") return null;
  const id = toNullableId(raw);
  if (!id) return null;
  const target = all.find((c) => c.id === id);
  if (!target) throw new Error("El cliente final seleccionado no existe.");
  if (target.clientKind !== "FINAL") {
    throw new Error("Solo puedes vincular un cliente con tipo «cliente final».");
  }
  return id;
}

function resolveLinkedFinalForUpdate(
  all: ClientRecord[],
  selfId: string,
  clientKind: ClientKind,
  raw: string | null | undefined
): string | null {
  if (clientKind !== "INTERMEDIARIO") return null;
  const id = toNullableId(raw);
  if (!id) return null;
  if (id === selfId) throw new Error("No puedes indicar este mismo cliente como cliente final.");
  const target = all.find((c) => c.id === id);
  if (!target) throw new Error("El cliente final seleccionado no existe.");
  if (target.clientKind !== "FINAL") {
    throw new Error("Solo puedes vincular un cliente con tipo «cliente final».");
  }
  return id;
}

function loadRaw(): ClientRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ClientRecord[];
    if (!Array.isArray(parsed)) return [];
    const list = parsed.map(migrateRecord);
    const byId = new Map(list.map((c) => [c.id, c] as const));
    return list.map((c) => {
      const lid = c.linkedFinalClientId;
      if (!lid) return { ...c, linkedFinalClientId: null };
      const target = byId.get(lid);
      if (!target || target.clientKind !== "FINAL") {
        return { ...c, linkedFinalClientId: null };
      }
      return c;
    });
  } catch {
    return [];
  }
}

function seedIfEmpty(): void {
  const clients = loadRaw();
  if (clients.length > 0) return;

  const now = new Date().toISOString();
  const demoFinal: ClientRecord = {
    id: "c-seed-final-1",
    tradeName: "Retail Sur",
    companyName: "Retail Sur S.A.",
    cif: "A87654321",
    fiscalAddress: "Av. Principal 100, 41001 Sevilla",
    clientKind: "FINAL",
    linkedFinalClientId: null,
    phone: "+34 954 000 000",
    contactEmail: "compras@retailsur.es",
    notes: "Cliente final de ejemplo.",
    active: true,
    contacts: [],
    createdAt: now,
    updatedAt: now,
  };

  const demo: ClientRecord = {
    id: "c-seed-1",
    tradeName: "Distribuciones Norte",
    companyName: "Distribuciones Norte S.L.",
    cif: "B12345678",
    fiscalAddress: "Polígono Industrial, Nave 4, 28001 Madrid",
    clientKind: "INTERMEDIARIO",
    linkedFinalClientId: "c-seed-final-1",
    phone: "+34 912 000 000",
    contactEmail: "info@distribnorte.es",
    notes: "Cliente de demostración (intermediario vinculado a un cliente final de ejemplo).",
    active: true,
    contacts: [
      {
        id: "cp-seed-1",
        firstName: "Ana",
        lastName: "Martínez Ruiz",
        email: "ana.martinez@distribnorte.es",
        mobile: "+34 600 111 222",
        position: "Directora comercial",
        description: "Interlocutora principal para pedidos y facturación.",
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  saveAll([demoFinal, demo]);
}

export function ensureClientsSeeded(): void {
  seedIfEmpty();
}

export function getClientsSnapshot(): ClientRecord[] {
  ensureClientsSeeded();
  const raw = localStorage.getItem(STORAGE_KEY) ?? "";
  if (raw === snapshotRawKey && snapshotCache) {
    return snapshotCache;
  }
  const clients = loadRaw();
  snapshotRawKey = raw;
  snapshotCache = clients;
  return snapshotCache;
}

export function getClientById(id: string): ClientRecord | undefined {
  return getClientsSnapshot().find((c) => c.id === id);
}

export type CreateClientInput = {
  tradeName: string;
  companyName: string;
  cif: string;
  fiscalAddress: string;
  clientKind: ClientKind;
  /** Solo intermediarios; id de un cliente con tipo FINAL */
  linkedFinalClientId?: string | null;
  phone: string;
  contactEmail: string;
  notes: string;
  active: boolean;
};

export function createClient(input: CreateClientInput): ClientRecord {
  const clients = loadRaw();
  const now = new Date().toISOString();
  const cifNorm = input.cif.trim().toUpperCase();
  if (clients.some((c) => c.cif.replace(/\s/g, "") === cifNorm.replace(/\s/g, ""))) {
    throw new Error("Ya existe un cliente con ese CIF.");
  }
  const newId = `c-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const record: ClientRecord = {
    id: newId,
    tradeName: input.tradeName.trim(),
    companyName: input.companyName.trim(),
    cif: cifNorm,
    fiscalAddress: input.fiscalAddress.trim(),
    clientKind: input.clientKind,
    linkedFinalClientId: resolveLinkedFinalForCreate(
      clients,
      input.clientKind,
      input.linkedFinalClientId
    ),
    phone: input.phone.trim(),
    contactEmail: input.contactEmail.trim().toLowerCase(),
    notes: input.notes.trim(),
    active: input.active,
    contacts: [],
    createdAt: now,
    updatedAt: now,
  };
  clients.push(record);
  saveAll(clients);
  return record;
}

export type UpdateClientInput = Partial<CreateClientInput>;

export function updateClient(id: string, input: UpdateClientInput): ClientRecord {
  const clients = loadRaw();
  const idx = clients.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error("Cliente no encontrado.");

  const current = clients[idx];
  const nextCif = input.cif !== undefined ? input.cif.trim().toUpperCase() : current.cif;
  const cifConflict = clients.some(
    (c, i) =>
      i !== idx && c.cif.replace(/\s/g, "") === nextCif.replace(/\s/g, "")
  );
  if (cifConflict) throw new Error("Ya existe otro cliente con ese CIF.");

  const nextKind = input.clientKind ?? current.clientKind;
  const rawLink =
    input.linkedFinalClientId !== undefined
      ? input.linkedFinalClientId
      : current.linkedFinalClientId;
  const nextLinked = resolveLinkedFinalForUpdate(clients, id, nextKind, rawLink);

  const next: ClientRecord = {
    ...current,
    tradeName: input.tradeName !== undefined ? input.tradeName.trim() : current.tradeName,
    companyName: input.companyName !== undefined ? input.companyName.trim() : current.companyName,
    cif: nextCif,
    fiscalAddress:
      input.fiscalAddress !== undefined ? input.fiscalAddress.trim() : current.fiscalAddress,
    clientKind: nextKind,
    linkedFinalClientId: nextLinked,
    phone: input.phone !== undefined ? input.phone.trim() : current.phone,
    contactEmail:
      input.contactEmail !== undefined
        ? input.contactEmail.trim().toLowerCase()
        : current.contactEmail,
    notes: input.notes !== undefined ? input.notes.trim() : current.notes,
    active: input.active !== undefined ? input.active : current.active,
    updatedAt: new Date().toISOString(),
  };

  clients[idx] = next;
  saveAll(clients);
  return next;
}

export function deleteClient(id: string): void {
  const clients = loadRaw();
  const filtered = clients
    .filter((c) => c.id !== id)
    .map((c) =>
      c.linkedFinalClientId === id ? { ...c, linkedFinalClientId: null } : c
    );
  saveAll(filtered);
}

export type CreateContactInput = Omit<ClientContactPerson, "id">;

export function addContact(clientId: string, input: CreateContactInput): ClientContactPerson {
  const clients = loadRaw();
  const idx = clients.findIndex((c) => c.id === clientId);
  if (idx === -1) throw new Error("Cliente no encontrado.");

  const contact: ClientContactPerson = {
    id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    mobile: input.mobile.trim(),
    position: input.position.trim(),
    description: input.description.trim(),
  };

  const list = [...clients[idx].contacts, contact];
  clients[idx] = { ...clients[idx], contacts: list, updatedAt: new Date().toISOString() };
  saveAll(clients);
  return contact;
}

export type UpdateContactInput = Partial<CreateContactInput>;

export function updateContact(
  clientId: string,
  contactId: string,
  input: UpdateContactInput
): ClientContactPerson {
  const clients = loadRaw();
  const cIdx = clients.findIndex((c) => c.id === clientId);
  if (cIdx === -1) throw new Error("Cliente no encontrado.");

  const contacts = clients[cIdx].contacts.map((p) => {
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

  clients[cIdx] = {
    ...clients[cIdx],
    contacts,
    updatedAt: new Date().toISOString(),
  };
  saveAll(clients);
  return contacts.find((p) => p.id === contactId)!;
}

export function removeContact(clientId: string, contactId: string): void {
  const clients = loadRaw();
  const cIdx = clients.findIndex((c) => c.id === clientId);
  if (cIdx === -1) throw new Error("Cliente no encontrado.");

  clients[cIdx] = {
    ...clients[cIdx],
    contacts: clients[cIdx].contacts.filter((p) => p.id !== contactId),
    updatedAt: new Date().toISOString(),
  };
  saveAll(clients);
}
