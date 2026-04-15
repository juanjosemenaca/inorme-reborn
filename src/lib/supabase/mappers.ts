/**
 * Mapeo bidireccional: filas Postgres (snake_case) ↔ modelos de dominio (camelCase).
 */
import type {
  BackofficeUserInsert,
  BackofficeUserRow,
  ClientContactPersonRow,
  ClientInsert,
  ClientRow,
  CompanyWorkerInsert,
  CompanyWorkerRow,
  ProjectDocumentRow,
  ProjectInsert,
  ProjectMemberRow,
  ProjectRow,
  WorkCalendarHolidayRow,
  WorkCalendarSiteRow,
  WorkCalendarSummerRangeRow,
  ProviderContactPersonInsert,
  ProviderContactPersonRow,
  ProviderInsert,
  ProviderRow,
} from "@/types/database";
import {
  ALL_WORKER_MODULES,
  type BackofficeUserRecord,
  type EmploymentType,
  type UserRole,
  type WorkerModuleKey,
} from "@/types/backoffice";
import type { ClientContactPerson, ClientContactPurpose, ClientKind, ClientRecord } from "@/types/clients";
import type { AutonomoVia, CompanyWorkerEmploymentType, CompanyWorkerRecord } from "@/types/companyWorkers";
import type { ProviderRecord } from "@/types/providers";
import type {
  ProjectDocumentRecord,
  ProjectMemberRecord,
  ProjectMemberRole,
  ProjectRecord,
} from "@/types/projects";
import type {
  WorkCalendarHolidayKind,
  WorkCalendarHolidayRecord,
  WorkCalendarSiteRecord,
  WorkCalendarSummerRangeRecord,
} from "@/types/workCalendars";
import { isoDateOnlyFromDb } from "@/lib/isoDate";

// ---------------------------------------------------------------------------
// Proyectos
// ---------------------------------------------------------------------------

export function projectRowToDomain(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    clientId: row.client_id,
    finalClientId: row.final_client_id,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function projectDocumentRowToDomain(row: ProjectDocumentRow): ProjectDocumentRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    createdAt: row.created_at,
  };
}

export function projectMemberRowToDomain(row: ProjectMemberRow): ProjectMemberRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    companyWorkerId: row.company_worker_id,
    role: row.role as ProjectMemberRole,
    createdAt: row.created_at,
  };
}

export function workCalendarSiteRowToDomain(row: WorkCalendarSiteRow): WorkCalendarSiteRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    vacationDaysDefault: row.vacation_days_default,
    isSystem: row.is_system,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function workCalendarHolidayRowToDomain(row: WorkCalendarHolidayRow): WorkCalendarHolidayRecord {
  return {
    id: row.id,
    calendarYear: row.calendar_year,
    siteId: row.site_id,
    holidayDate: isoDateOnlyFromDb(row.holiday_date),
    holidayKind: (row.holiday_kind ?? "NACIONAL") as WorkCalendarHolidayKind,
    label: row.label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function workCalendarSummerRangeRowToDomain(row: WorkCalendarSummerRangeRow): WorkCalendarSummerRangeRecord {
  return {
    id: row.id,
    calendarYear: row.calendar_year,
    siteId: row.site_id,
    dateStart: isoDateOnlyFromDb(row.date_start),
    dateEnd: isoDateOnlyFromDb(row.date_end),
    label: row.label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function projectRecordToInsert(
  record: Omit<ProjectRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }
): ProjectInsert {
  return {
    id: record.id || undefined,
    title: record.title,
    description: record.description,
    client_id: record.clientId,
    final_client_id: record.finalClientId,
    start_date: record.startDate,
    end_date: record.endDate,
  };
}

// ---------------------------------------------------------------------------
// Contactos (compartido cliente / proveedor)
// ---------------------------------------------------------------------------

type ContactPersonRowCore = Pick<
  ClientContactPersonRow,
  "id" | "first_name" | "last_name" | "email" | "mobile" | "position" | "description"
>;

function contactPersonRowCoreToDomain(row: ContactPersonRowCore): Omit<ClientContactPerson, "contactPurpose"> {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    mobile: row.mobile,
    position: row.position,
    description: row.description,
  };
}

export function clientContactRowToDomain(row: ClientContactPersonRow): ClientContactPerson {
  const purpose = (row.contact_purpose as ClientContactPurpose | undefined) ?? "GENERAL";
  return {
    ...contactPersonRowCoreToDomain(row),
    contactPurpose: purpose === "INVOICE" ? "INVOICE" : "GENERAL",
  };
}

export function providerContactRowToDomain(row: ProviderContactPersonRow): ClientContactPerson {
  return {
    ...contactPersonRowCoreToDomain(row),
    contactPurpose: "GENERAL",
  };
}

export function clientContactToClientInsert(
  clientId: string,
  c: ClientContactPerson
): ClientContactPersonInsert {
  return {
    client_id: clientId,
    id: c.id || undefined,
    first_name: c.firstName,
    last_name: c.lastName,
    email: c.email,
    mobile: c.mobile,
    position: c.position,
    description: c.description,
    contact_purpose: c.contactPurpose === "INVOICE" ? "INVOICE" : "GENERAL",
  };
}

export function clientContactToProviderInsert(
  providerId: string,
  c: ClientContactPerson
): ProviderContactPersonInsert {
  return {
    provider_id: providerId,
    id: c.id || undefined,
    first_name: c.firstName,
    last_name: c.lastName,
    email: c.email,
    mobile: c.mobile,
    position: c.position,
    description: c.description,
  };
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export function clientRowToDomain(row: ClientRow, contacts: ClientContactPersonRow[]): ClientRecord {
  return {
    id: row.id,
    tradeName: row.trade_name,
    companyName: row.company_name,
    cif: row.cif,
    postalAddress: row.postal_address ?? "",
    fiscalAddress: row.fiscal_address,
    clientKind: row.client_kind as ClientKind,
    linkedFinalClientId: row.linked_final_client_id,
    phone: row.phone,
    contactEmail: row.contact_email,
    websiteUrl: row.website_url?.trim() ?? "",
    notes: row.notes,
    invoiceAddresseeLine: row.invoice_addressee_line?.trim() ?? "",
    active: row.active,
    contacts: contacts.map(clientContactRowToDomain),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Solo la fila `clients` (sin contactos). Útil para `.insert().select().single()`.
 */
export function clientRecordToRowInsert(record: Omit<ClientRecord, "contacts" | "createdAt" | "updatedAt">): ClientInsert {
  return {
    id: record.id || undefined,
    trade_name: record.tradeName,
    company_name: record.companyName,
    cif: record.cif,
    postal_address: record.postalAddress,
    fiscal_address: record.fiscalAddress,
    client_kind: record.clientKind,
    linked_final_client_id: record.linkedFinalClientId,
    phone: record.phone,
    contact_email: record.contactEmail,
    website_url: record.websiteUrl?.trim() ?? "",
    notes: record.notes,
    invoice_addressee_line: record.invoiceAddresseeLine?.trim() || null,
    active: record.active,
  };
}

// ---------------------------------------------------------------------------
// Proveedores
// ---------------------------------------------------------------------------

export function providerRowToDomain(row: ProviderRow, contacts: ProviderContactPersonRow[]): ProviderRecord {
  return {
    id: row.id,
    tradeName: row.trade_name,
    companyName: row.company_name,
    cif: row.cif,
    fiscalAddress: row.fiscal_address,
    phone: row.phone,
    contactEmail: row.contact_email,
    notes: row.notes,
    active: row.active,
    contacts: contacts.map(providerContactRowToDomain),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function providerRecordToRowInsert(
  record: Omit<ProviderRecord, "contacts" | "createdAt" | "updatedAt">
): ProviderInsert {
  return {
    id: record.id || undefined,
    trade_name: record.tradeName,
    company_name: record.companyName,
    cif: record.cif,
    fiscal_address: record.fiscalAddress,
    phone: record.phone,
    contact_email: record.contactEmail,
    notes: record.notes,
    active: record.active,
  };
}

// ---------------------------------------------------------------------------
// Trabajadores empresa
// ---------------------------------------------------------------------------

export function companyWorkerRowToDomain(row: CompanyWorkerRow): CompanyWorkerRecord {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    dni: row.dni,
    email: row.email,
    mobile: row.mobile,
    postalAddress: row.postal_address,
    city: row.city,
    employmentType: row.employment_type as CompanyWorkerEmploymentType,
    providerId: row.provider_id,
    autonomoVia: row.autonomo_via as AutonomoVia | null,
    workCalendarSiteId: row.work_calendar_site_id,
    vacationDays: row.vacation_days,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function companyWorkerRecordToRowInsert(
  record: Omit<CompanyWorkerRecord, "createdAt" | "updatedAt">
): CompanyWorkerInsert {
  return {
    id: record.id || undefined,
    first_name: record.firstName,
    last_name: record.lastName,
    dni: record.dni,
    email: record.email,
    mobile: record.mobile,
    postal_address: record.postalAddress,
    city: record.city,
    employment_type: record.employmentType,
    provider_id: record.providerId,
    autonomo_via: record.autonomoVia,
    work_calendar_site_id: record.workCalendarSiteId,
    vacation_days: record.vacationDays,
    active: record.active,
  };
}

// ---------------------------------------------------------------------------
// Usuarios backoffice (sin contraseña en BD)
// ---------------------------------------------------------------------------

/** Valor de `password` en dominio cuando el usuario viene solo de Supabase (Auth gestiona credenciales). */
export const BACKOFFICE_PASSWORD_FROM_DB = "" as const;

function normalizeUserRole(value: unknown): UserRole {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  return raw === "ADMIN" ? "ADMIN" : "WORKER";
}

function normalizeModules(value: unknown): WorkerModuleKey[] {
  const arr = Array.isArray(value) ? value : [];
  const set = new Set<WorkerModuleKey>();
  for (const v of arr) {
    const raw = typeof v === "string" ? v.trim().toUpperCase() : "";
    if (
      raw === "VACATIONS" ||
      raw === "MESSAGES" ||
      raw === "TIME_CLOCK" ||
      raw === "AGENDA" ||
      raw === "GASTOS"
    ) {
      set.add(raw);
    }
  }
  return set.size > 0 ? [...set] : [...ALL_WORKER_MODULES];
}

export function backofficeUserRowToDomain(
  row: BackofficeUserRow,
  options?: { password?: string }
): BackofficeUserRecord {
  return {
    id: row.id,
    email: row.email,
    password: options?.password ?? BACKOFFICE_PASSWORD_FROM_DB,
    role: normalizeUserRole(row.role),
    companyWorkerId: row.company_worker_id,
    firstName: row.first_name,
    lastName: row.last_name,
    dni: row.dni,
    mobile: row.mobile,
    postalAddress: row.postal_address,
    city: row.city,
    employmentType: row.employment_type as EmploymentType,
    active: row.active,
    enabledModules: normalizeModules(row.enabled_modules),
    mustChangePassword: row.must_change_password === true,
    passwordChangedAt: row.password_changed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Campos persistibles en `public.backoffice_users` (sin password).
 * Para enlazar Auth: añade `auth_user_id` en el objeto o tras `signUp` / `signIn`.
 */
export function backofficeUserRecordToRowInsert(
  record: Omit<BackofficeUserRecord, "password" | "createdAt" | "updatedAt">
): BackofficeUserInsert {
  return {
    id: record.id || undefined,
    email: record.email,
    role: record.role,
    company_worker_id: record.companyWorkerId,
    first_name: record.firstName,
    last_name: record.lastName,
    dni: record.dni,
    mobile: record.mobile,
    postal_address: record.postalAddress,
    city: record.city,
    employment_type: record.employmentType,
    active: record.active,
    enabled_modules: record.enabledModules,
    must_change_password: record.mustChangePassword,
    password_changed_at: record.passwordChangedAt,
  };
}
