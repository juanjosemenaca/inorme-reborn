import { requireSupabase } from "@/api/supabaseRequire";
import { sortByLocaleKey } from "@/lib/sortAlpha";
import {
  providerContactRowToDomain,
  providerRecordToRowInsert,
  clientContactToProviderInsert,
  providerRowToDomain,
} from "@/lib/supabase/mappers";
import type { ProviderContactPersonRow, ProviderRow } from "@/types/database";
import type { ClientContactPerson } from "@/types/clients";
import type { ProviderRecord } from "@/types/providers";

export async function fetchProviders(): Promise<ProviderRecord[]> {
  const sb = requireSupabase();
  const { data: rows, error } = await sb.from("providers").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  const { data: contactRows, error: cErr } = await sb.from("provider_contact_persons").select("*");
  if (cErr) throw cErr;
  const byProv = new Map<string, ProviderContactPersonRow[]>();
  for (const c of contactRows ?? []) {
    const list = byProv.get(c.provider_id) ?? [];
    list.push(c as ProviderContactPersonRow);
    byProv.set(c.provider_id, list);
  }
  const list = (rows ?? []).map((row) =>
    providerRowToDomain(row as ProviderRow, byProv.get((row as ProviderRow).id) ?? [])
  );
  return sortByLocaleKey(list, (p) => p.tradeName.trim() || p.companyName.trim() || p.cif);
}

export async function getProviderById(id: string): Promise<ProviderRecord | undefined> {
  const all = await fetchProviders();
  return all.find((p) => p.id === id);
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

export async function createProvider(input: CreateProviderInput): Promise<ProviderRecord> {
  const sb = requireSupabase();
  const rows = await fetchProviders();
  const cifNorm = input.cif.trim().toUpperCase();
  if (
    cifNorm.length > 0 &&
    rows.some((p) => p.cif.replace(/\s/g, "") === cifNorm.replace(/\s/g, ""))
  ) {
    throw new Error("Ya existe un proveedor con ese CIF.");
  }
  const row = providerRecordToRowInsert({
    id: "",
    tradeName: input.tradeName.trim(),
    companyName: input.companyName.trim(),
    cif: cifNorm,
    fiscalAddress: input.fiscalAddress.trim(),
    phone: input.phone.trim(),
    contactEmail: input.contactEmail.trim().toLowerCase(),
    notes: input.notes.trim(),
    active: input.active,
  });
  delete (row as { id?: string }).id;
  const { data: inserted, error } = await sb.from("providers").insert(row).select("*").single();
  if (error) throw error;
  return providerRowToDomain(inserted as ProviderRow, []);
}

export type UpdateProviderInput = Partial<CreateProviderInput>;

export async function updateProvider(id: string, input: UpdateProviderInput): Promise<ProviderRecord> {
  const sb = requireSupabase();
  const all = await fetchProviders();
  const idx = all.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error("Proveedor no encontrado.");
  const current = all[idx];
  const nextCif = input.cif !== undefined ? input.cif.trim().toUpperCase() : current.cif;
  const nextCifNorm = nextCif.replace(/\s/g, "");
  const conflict =
    nextCifNorm.length > 0 &&
    all.some((p, i) => i !== idx && p.cif.replace(/\s/g, "") === nextCifNorm);
  if (conflict) throw new Error("Ya existe otro proveedor con ese CIF.");
  const patch = providerRecordToRowInsert({
    id,
    tradeName: input.tradeName !== undefined ? input.tradeName.trim() : current.tradeName,
    companyName: input.companyName !== undefined ? input.companyName.trim() : current.companyName,
    cif: nextCif,
    fiscalAddress: input.fiscalAddress !== undefined ? input.fiscalAddress.trim() : current.fiscalAddress,
    phone: input.phone !== undefined ? input.phone.trim() : current.phone,
    contactEmail:
      input.contactEmail !== undefined
        ? input.contactEmail.trim().toLowerCase()
        : current.contactEmail,
    notes: input.notes !== undefined ? input.notes.trim() : current.notes,
    active: input.active !== undefined ? input.active : current.active,
  });
  const { data: updated, error } = await sb
    .from("providers")
    .update({
      trade_name: patch.trade_name,
      company_name: patch.company_name,
      cif: patch.cif,
      fiscal_address: patch.fiscal_address,
      phone: patch.phone,
      contact_email: patch.contact_email,
      notes: patch.notes,
      active: patch.active,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  const { data: contactRows } = await sb.from("provider_contact_persons").select("*").eq("provider_id", id);
  return providerRowToDomain(updated as ProviderRow, (contactRows ?? []) as ProviderContactPersonRow[]);
}

export async function deleteProvider(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("providers").delete().eq("id", id);
  if (error) throw error;
}

export type CreateContactInput = Omit<ClientContactPerson, "id">;

export async function addProviderContact(
  providerId: string,
  input: CreateContactInput
): Promise<ClientContactPerson> {
  const sb = requireSupabase();
  const contact: ClientContactPerson = {
    id: "",
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    mobile: input.mobile.trim(),
    position: input.position.trim(),
    description: input.description.trim(),
    contactPurpose: input.contactPurpose ?? "GENERAL",
  };
  const payload = clientContactToProviderInsert(providerId, contact);
  delete (payload as { id?: string }).id;
  const { data: row, error } = await sb.from("provider_contact_persons").insert(payload).select("*").single();
  if (error) throw error;
  return providerContactRowToDomain(row as ProviderContactPersonRow);
}

export async function updateProviderContact(
  providerId: string,
  contactId: string,
  input: Partial<CreateContactInput>
): Promise<ClientContactPerson> {
  const sb = requireSupabase();
  const { data: existing, error: e0 } = await sb
    .from("provider_contact_persons")
    .select("*")
    .eq("provider_id", providerId)
    .eq("id", contactId)
    .maybeSingle();
  if (e0) throw e0;
  if (!existing) throw new Error("Contacto no encontrado.");
  const cur = providerContactRowToDomain(existing as ProviderContactPersonRow);
  const next = {
    first_name: input.firstName !== undefined ? input.firstName.trim() : cur.firstName,
    last_name: input.lastName !== undefined ? input.lastName.trim() : cur.lastName,
    email: input.email !== undefined ? input.email.trim().toLowerCase() : cur.email,
    mobile: input.mobile !== undefined ? input.mobile.trim() : cur.mobile,
    position: input.position !== undefined ? input.position.trim() : cur.position,
    description: input.description !== undefined ? input.description.trim() : cur.description,
  };
  const { data: row, error } = await sb
    .from("provider_contact_persons")
    .update(next)
    .eq("id", contactId)
    .eq("provider_id", providerId)
    .select("*")
    .single();
  if (error) throw error;
  return providerContactRowToDomain(row as ProviderContactPersonRow);
}

export async function removeProviderContact(providerId: string, contactId: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from("provider_contact_persons")
    .delete()
    .eq("provider_id", providerId)
    .eq("id", contactId);
  if (error) throw error;
}
