import { requireSupabase } from "@/api/supabaseRequire";
import { getProfileByAuthUserId } from "@/api/backofficeUsersApi";
import { getWorkCalendarSiteById } from "@/api/workCalendarSitesApi";
import { getProviderById } from "@/api/providersApi";
import { sortByLocaleKey } from "@/lib/sortAlpha";
import { companyWorkerRecordToRowInsert, companyWorkerRowToDomain } from "@/lib/supabase/mappers";
import type { CompanyWorkerRow } from "@/types/database";
import {
  companyWorkerDisplayName,
  type AutonomoVia,
  type CompanyWorkerEmploymentType,
  type CompanyWorkerRecord,
} from "@/types/companyWorkers";

async function normalizeEmploymentFields(
  employmentType: CompanyWorkerEmploymentType,
  providerId: string | null | undefined,
  autonomoVia: AutonomoVia | null | undefined
): Promise<{ providerId: string | null; autonomoVia: AutonomoVia | null }> {
  if (employmentType === "FIJO" || employmentType === "TEMPORAL" || employmentType === "PRACTICAS") {
    return { providerId: null, autonomoVia: null };
  }
  if (employmentType === "SUBCONTRATADO") {
    const pid = (providerId ?? "").trim();
    if (!pid) throw new Error("Indica el proveedor (empresa) del subcontratado.");
    const p = await getProviderById(pid);
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
    const p = await getProviderById(pid);
    if (!p || !p.active) throw new Error("El proveedor seleccionado no existe o está inactivo.");
    return { providerId: pid, autonomoVia: "EMPRESA" };
  }
  return { providerId: null, autonomoVia: null };
}

export async function fetchCompanyWorkers(): Promise<CompanyWorkerRecord[]> {
  const sb = requireSupabase();
  const { data: rows, error } = await sb
    .from("company_workers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const list = (rows ?? []).map((row) => companyWorkerRowToDomain(row as CompanyWorkerRow));
  return sortByLocaleKey(list, (w) => companyWorkerDisplayName(w));
}

export async function getCompanyWorkerById(id: string): Promise<CompanyWorkerRecord | undefined> {
  const all = await fetchCompanyWorkers();
  return all.find((w) => w.id === id);
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
  workCalendarSiteId: string;
  vacationDays: number;
  active: boolean;
};

export async function createCompanyWorker(input: CreateCompanyWorkerInput): Promise<CompanyWorkerRecord> {
  const sb = requireSupabase();
  const rows = await fetchCompanyWorkers();
  const dniNorm = input.dni.trim().toUpperCase();
  if (
    dniNorm.length > 0 &&
    rows.some((w) => w.dni.replace(/\s/g, "") === dniNorm.replace(/\s/g, ""))
  ) {
    throw new Error("Ya existe una persona con ese DNI/NIE.");
  }
  const { providerId, autonomoVia } = await normalizeEmploymentFields(
    input.employmentType,
    input.providerId,
    input.autonomoVia
  );
  const vd = Math.min(365, Math.max(0, Math.floor(input.vacationDays)));
  const record = companyWorkerRecordToRowInsert({
    id: "",
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
    workCalendarSiteId: input.workCalendarSiteId,
    vacationDays: vd,
    active: input.active,
  });
  delete (record as { id?: string }).id;
  const { data: inserted, error } = await sb.from("company_workers").insert(record).select("*").single();
  if (error) throw error;
  return companyWorkerRowToDomain(inserted as CompanyWorkerRow);
}

export type UpdateCompanyWorkerInput = Partial<CreateCompanyWorkerInput>;

export async function updateCompanyWorker(
  id: string,
  input: UpdateCompanyWorkerInput
): Promise<CompanyWorkerRecord> {
  const sb = requireSupabase();
  const rows = await fetchCompanyWorkers();
  const idx = rows.findIndex((w) => w.id === id);
  if (idx === -1) throw new Error("Trabajador no encontrado.");
  const current = rows[idx];
  const nextDni = input.dni !== undefined ? input.dni.trim().toUpperCase() : current.dni;
  const nextDniNorm = nextDni.replace(/\s/g, "");
  const dniConflict =
    nextDniNorm.length > 0 &&
    rows.some((w, i) => i !== idx && w.dni.replace(/\s/g, "") === nextDniNorm);
  if (dniConflict) throw new Error("Ya existe otra persona con ese DNI/NIE.");
  const nextType = input.employmentType ?? current.employmentType;
  const { providerId, autonomoVia } = await normalizeEmploymentFields(
    nextType,
    input.providerId !== undefined ? input.providerId : current.providerId,
    input.autonomoVia !== undefined ? input.autonomoVia : current.autonomoVia
  );
  const nextSiteId = input.workCalendarSiteId ?? current.workCalendarSiteId;
  const nextVacation =
    input.vacationDays !== undefined
      ? Math.min(365, Math.max(0, Math.floor(input.vacationDays)))
      : current.vacationDays;
  const patch = companyWorkerRecordToRowInsert({
    id,
    firstName: input.firstName !== undefined ? input.firstName.trim() : current.firstName,
    lastName: input.lastName !== undefined ? input.lastName.trim() : current.lastName,
    dni: nextDni,
    email: input.email !== undefined ? input.email.trim().toLowerCase() : current.email,
    mobile: input.mobile !== undefined ? input.mobile.trim() : current.mobile,
    postalAddress: input.postalAddress !== undefined ? input.postalAddress.trim() : current.postalAddress,
    city: input.city !== undefined ? input.city.trim() : current.city,
    employmentType: nextType,
    providerId,
    autonomoVia,
    workCalendarSiteId: nextSiteId,
    vacationDays: nextVacation,
    active: input.active !== undefined ? input.active : current.active,
  });
  const { data: updated, error } = await sb
    .from("company_workers")
    .update({
      first_name: patch.first_name,
      last_name: patch.last_name,
      dni: patch.dni,
      email: patch.email,
      mobile: patch.mobile,
      postal_address: patch.postal_address,
      city: patch.city,
      employment_type: patch.employment_type,
      provider_id: patch.provider_id,
      autonomo_via: patch.autonomo_via,
      work_calendar_site_id: patch.work_calendar_site_id,
      vacation_days: patch.vacation_days,
      active: patch.active,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return companyWorkerRowToDomain(updated as CompanyWorkerRow);
}

/**
 * Actualiza sede y días de vacaciones según el calendario por defecto de la nueva sede.
 * Solo la ficha vinculada al usuario autenticado.
 */
export async function updateMyWorkCalendarSite(
  companyWorkerId: string,
  workCalendarSiteId: string
): Promise<CompanyWorkerRecord> {
  const sb = requireSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sesión no válida.");
  const profile = await getProfileByAuthUserId(user.id);
  if (!profile?.companyWorkerId || profile.companyWorkerId !== companyWorkerId) {
    throw new Error("No puedes modificar la ficha de otro trabajador.");
  }
  const site = await getWorkCalendarSiteById(workCalendarSiteId);
  if (!site) throw new Error("Sede no encontrada.");
  return updateCompanyWorker(companyWorkerId, {
    workCalendarSiteId,
    vacationDays: site.vacationDaysDefault,
  });
}

export async function deleteCompanyWorker(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("company_workers").delete().eq("id", id);
  if (error) throw error;
}

export async function clearProviderLinksFromWorkers(providerId: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from("company_workers")
    .update({ provider_id: null })
    .eq("provider_id", providerId);
  if (error) throw error;
}
