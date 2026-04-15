import { syncDraftInvoicesRecipientWebsite } from "@/api/billingApi";
import { requireSupabase } from "@/api/supabaseRequire";
import {
  clientContactRowToDomain,
  clientRecordToRowInsert,
  clientContactToClientInsert,
  clientRowToDomain,
} from "@/lib/supabase/mappers";
import type { ClientContactPersonRow, ClientRow } from "@/types/database";
import type { ClientContactPerson, ClientKind, ClientRecord } from "@/types/clients";

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

export async function fetchClients(): Promise<ClientRecord[]> {
  const sb = requireSupabase();
  const { data: rows, error } = await sb.from("clients").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  const { data: contactRows, error: cErr } = await sb.from("client_contact_persons").select("*");
  if (cErr) throw cErr;
  const byClient = new Map<string, ClientContactPersonRow[]>();
  for (const c of contactRows ?? []) {
    const list = byClient.get(c.client_id) ?? [];
    list.push(c as ClientContactPersonRow);
    byClient.set(c.client_id, list);
  }
  const clientRows = (rows ?? []) as ClientRow[];
  const byId = new Map(clientRows.map((r) => [r.id, r]));
  return clientRows.map((row) => {
    const contacts = byClient.get(row.id) ?? [];
    let rec = clientRowToDomain(row, contacts);
    const lid = rec.linkedFinalClientId;
    if (lid) {
      const targetRow = byId.get(lid);
      if (!targetRow || targetRow.client_kind !== "FINAL") {
        rec = { ...rec, linkedFinalClientId: null };
      }
    }
    return rec;
  });
}

export type CreateClientInput = {
  tradeName: string;
  companyName: string;
  cif: string;
  postalAddress: string;
  fiscalAddress: string;
  clientKind: ClientKind;
  linkedFinalClientId?: string | null;
  phone: string;
  contactEmail: string;
  websiteUrl?: string;
  notes: string;
  invoiceAddresseeLine?: string;
  active: boolean;
};

export async function createClient(input: CreateClientInput): Promise<ClientRecord> {
  const sb = requireSupabase();
  const all = await fetchClients();
  const cifNorm = input.cif.trim().toUpperCase();
  if (
    cifNorm.length > 0 &&
    all.some((c) => c.cif.replace(/\s/g, "") === cifNorm.replace(/\s/g, ""))
  ) {
    throw new Error("Ya existe un cliente con ese CIF.");
  }
  const row = clientRecordToRowInsert({
    id: "",
    tradeName: input.tradeName.trim(),
    companyName: input.companyName.trim(),
    cif: cifNorm,
    postalAddress: input.postalAddress.trim(),
    fiscalAddress: input.fiscalAddress.trim(),
    clientKind: input.clientKind,
    linkedFinalClientId: resolveLinkedFinalForCreate(all, input.clientKind, input.linkedFinalClientId),
    phone: input.phone.trim(),
    contactEmail: input.contactEmail.trim().toLowerCase(),
    websiteUrl: input.websiteUrl?.trim() ?? "",
    notes: input.notes.trim(),
    invoiceAddresseeLine: input.invoiceAddresseeLine?.trim() ?? "",
    active: input.active,
  });
  delete (row as { id?: string }).id;
  const { data: inserted, error } = await sb.from("clients").insert(row).select("*").single();
  if (error) throw error;
  const contacts: ClientContactPersonRow[] = [];
  return clientRowToDomain(inserted as ClientRow, contacts);
}

export type UpdateClientInput = Partial<CreateClientInput>;

export async function updateClient(id: string, input: UpdateClientInput): Promise<ClientRecord> {
  const sb = requireSupabase();
  const all = await fetchClients();
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error("Cliente no encontrado.");
  const current = all[idx];
  const nextCif = input.cif !== undefined ? input.cif.trim().toUpperCase() : current.cif;
  const nextCifNorm = nextCif.replace(/\s/g, "");
  const cifConflict =
    nextCifNorm.length > 0 &&
    all.some((c, i) => i !== idx && c.cif.replace(/\s/g, "") === nextCifNorm);
  if (cifConflict) throw new Error("Ya existe otro cliente con ese CIF.");
  const nextKind = input.clientKind ?? current.clientKind;
  const rawLink =
    input.linkedFinalClientId !== undefined ? input.linkedFinalClientId : current.linkedFinalClientId;
  const nextLinked = resolveLinkedFinalForUpdate(all, id, nextKind, rawLink);
  const patch = clientRecordToRowInsert({
    id,
    tradeName: input.tradeName !== undefined ? input.tradeName.trim() : current.tradeName,
    companyName: input.companyName !== undefined ? input.companyName.trim() : current.companyName,
    cif: nextCif,
    postalAddress: input.postalAddress !== undefined ? input.postalAddress.trim() : current.postalAddress,
    fiscalAddress: input.fiscalAddress !== undefined ? input.fiscalAddress.trim() : current.fiscalAddress,
    clientKind: nextKind,
    linkedFinalClientId: nextLinked,
    phone: input.phone !== undefined ? input.phone.trim() : current.phone,
    contactEmail:
      input.contactEmail !== undefined
        ? input.contactEmail.trim().toLowerCase()
        : current.contactEmail,
    websiteUrl: input.websiteUrl !== undefined ? input.websiteUrl.trim() : current.websiteUrl,
    notes: input.notes !== undefined ? input.notes.trim() : current.notes,
    invoiceAddresseeLine:
      input.invoiceAddresseeLine !== undefined
        ? input.invoiceAddresseeLine.trim()
        : current.invoiceAddresseeLine,
    active: input.active !== undefined ? input.active : current.active,
  });
  const { data: updated, error } = await sb
    .from("clients")
    .update({
      trade_name: patch.trade_name,
      company_name: patch.company_name,
      cif: patch.cif,
      postal_address: patch.postal_address,
      fiscal_address: patch.fiscal_address,
      client_kind: patch.client_kind,
      linked_final_client_id: patch.linked_final_client_id,
      phone: patch.phone,
      contact_email: patch.contact_email,
      website_url: patch.website_url,
      notes: patch.notes,
      invoice_addressee_line: patch.invoice_addressee_line,
      active: patch.active,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  const web = (patch.website_url ?? "").trim();
  await syncDraftInvoicesRecipientWebsite(id, web || null);
  const { data: contactRows } = await sb.from("client_contact_persons").select("*").eq("client_id", id);
  return clientRowToDomain(updated as ClientRow, (contactRows ?? []) as ClientContactPersonRow[]);
}

export async function deleteClient(id: string): Promise<void> {
  const sb = requireSupabase();
  const all = await fetchClients();
  const others = all.filter((c) => c.id !== id);
  for (const c of others) {
    if (c.linkedFinalClientId === id) {
      await sb
        .from("clients")
        .update({ linked_final_client_id: null })
        .eq("id", c.id);
    }
  }
  const { error } = await sb.from("clients").delete().eq("id", id);
  if (error) throw error;
}

export type CreateContactInput = Omit<ClientContactPerson, "id">;

export async function addContact(clientId: string, input: CreateContactInput): Promise<ClientContactPerson> {
  const sb = requireSupabase();
  const payload = clientContactToClientInsert(clientId, {
    id: "",
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    mobile: input.mobile.trim(),
    position: input.position.trim(),
    description: input.description.trim(),
    contactPurpose: input.contactPurpose ?? "GENERAL",
  });
  delete (payload as { id?: string }).id;
  const { data: row, error } = await sb.from("client_contact_persons").insert(payload).select("*").single();
  if (error) throw error;
  return clientContactRowToDomain(row as ClientContactPersonRow);
}

export type UpdateContactInput = Partial<CreateContactInput>;

export async function updateContact(
  clientId: string,
  contactId: string,
  input: UpdateContactInput
): Promise<ClientContactPerson> {
  const sb = requireSupabase();
  const { data: existing, error: e0 } = await sb
    .from("client_contact_persons")
    .select("*")
    .eq("client_id", clientId)
    .eq("id", contactId)
    .maybeSingle();
  if (e0) throw e0;
  if (!existing) throw new Error("Contacto no encontrado.");
  const cur = clientContactRowToDomain(existing as ClientContactPersonRow);
  const existingRow = existing as ClientContactPersonRow;
  const purposeNext =
    input.contactPurpose !== undefined
      ? input.contactPurpose === "INVOICE"
        ? "INVOICE"
        : "GENERAL"
      : existingRow.contact_purpose === "INVOICE"
        ? "INVOICE"
        : "GENERAL";
  const next = {
    first_name: input.firstName !== undefined ? input.firstName.trim() : cur.firstName,
    last_name: input.lastName !== undefined ? input.lastName.trim() : cur.lastName,
    email: input.email !== undefined ? input.email.trim().toLowerCase() : cur.email,
    mobile: input.mobile !== undefined ? input.mobile.trim() : cur.mobile,
    position: input.position !== undefined ? input.position.trim() : cur.position,
    description: input.description !== undefined ? input.description.trim() : cur.description,
    contact_purpose: purposeNext,
  };
  const { data: row, error } = await sb
    .from("client_contact_persons")
    .update(next)
    .eq("id", contactId)
    .eq("client_id", clientId)
    .select("*")
    .single();
  if (error) throw error;
  return clientContactRowToDomain(row as ClientContactPersonRow);
}

export async function removeContact(clientId: string, contactId: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("client_contact_persons").delete().eq("client_id", clientId).eq("id", contactId);
  if (error) throw error;
}
