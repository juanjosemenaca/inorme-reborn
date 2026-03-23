/**
 * Filas Postgres (snake_case) alineadas con
 * Migraciones en `supabase/migrations/` (incl. proyectos, equipo en proyecto, calendarios laborales).
 * Úsalas con PostgREST / `supabase.from(...)` y mapea a `src/types/*.ts` con `@/lib/supabase/mappers`.
 */

export type DbUserRole = "ADMIN" | "WORKER";

export type DbEmploymentType =
  | "FIJO"
  | "TEMPORAL"
  | "AUTONOMO"
  | "PRACTICAS"
  | "SUBCONTRATADO";

export type DbClientKind = "FINAL" | "INTERMEDIARIO";

export type DbAutonomoVia = "CUENTA_PROPIA" | "EMPRESA";

export interface ProviderRow {
  id: string;
  trade_name: string;
  company_name: string;
  cif: string;
  fiscal_address: string;
  phone: string;
  contact_email: string;
  notes: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyWorkerRow {
  id: string;
  first_name: string;
  last_name: string;
  dni: string;
  email: string;
  mobile: string;
  postal_address: string;
  city: string;
  employment_type: DbEmploymentType;
  provider_id: string | null;
  autonomo_via: DbAutonomoVia | null;
  /** Calendario laboral por sede; opcional en clientes antiguos hasta aplicar migración. */
  work_calendar_scope?: "BARCELONA" | "MADRID" | "ARRASATE_MONDRAGON";
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientRow {
  id: string;
  trade_name: string;
  company_name: string;
  cif: string;
  fiscal_address: string;
  client_kind: DbClientKind;
  linked_final_client_id: string | null;
  phone: string;
  contact_email: string;
  notes: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientContactPersonRow {
  id: string;
  client_id: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile: string;
  position: string;
  description: string;
}

export interface ProviderContactPersonRow {
  id: string;
  provider_id: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile: string;
  position: string;
  description: string;
}

export interface ProjectRow {
  id: string;
  title: string;
  description: string;
  client_id: string;
  final_client_id: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectDocumentRow {
  id: string;
  project_id: string;
  storage_path: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export type DbProjectMemberRole =
  | "CONSULTOR"
  | "ANALISTA_FUNCIONAL"
  | "ANALISTA_PROGRAMADOR"
  | "PROGRAMADOR"
  | "JEFE_DE_EQUIPO";

export interface ProjectMemberRow {
  id: string;
  project_id: string;
  company_worker_id: string;
  role: DbProjectMemberRole;
  created_at: string;
}

export interface BackofficeUserRow {
  id: string;
  email: string;
  role: DbUserRole;
  company_worker_id: string | null;
  first_name: string;
  last_name: string;
  dni: string;
  mobile: string;
  postal_address: string;
  city: string;
  employment_type: DbEmploymentType;
  active: boolean;
  auth_user_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Payload para insertar proveedor (sin timestamps si los pone el servidor). */
export type ProviderInsert = Omit<ProviderRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
};

/** Payload para insertar trabajador. */
export type CompanyWorkerInsert = Omit<CompanyWorkerRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
};

/** Payload para insertar cliente. */
export type ClientInsert = Omit<ClientRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
};

export type ClientContactPersonInsert = Omit<ClientContactPersonRow, "id"> & {
  id?: string;
};

export type ProviderContactPersonInsert = Omit<ProviderContactPersonRow, "id"> & {
  id?: string;
};

export type ProjectInsert = Omit<ProjectRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
};

export type ProjectDocumentInsert = Omit<ProjectDocumentRow, "id" | "created_at"> & {
  id?: string;
};

export type ProjectMemberInsert = Omit<ProjectMemberRow, "id" | "created_at"> & {
  id?: string;
};

export type DbWorkCalendarScope = "BARCELONA" | "MADRID" | "ARRASATE_MONDRAGON";

export type DbWorkCalendarHolidayKind = "NACIONAL" | "AUTONOMICO" | "LOCAL";

export interface WorkCalendarHolidayRow {
  id: string;
  calendar_year: number;
  scope: DbWorkCalendarScope;
  holiday_date: string;
  holiday_kind: DbWorkCalendarHolidayKind;
  label: string;
  created_at: string;
  updated_at: string;
}

export interface WorkCalendarSummerRangeRow {
  id: string;
  calendar_year: number;
  scope: DbWorkCalendarScope;
  date_start: string;
  date_end: string;
  label: string;
  created_at: string;
  updated_at: string;
}

/** Perfil backoffice (sin contraseña; Auth en `auth.users`). */
export type BackofficeUserInsert = Omit<
  BackofficeUserRow,
  "id" | "created_at" | "updated_at" | "auth_user_id"
> & {
  id?: string;
  auth_user_id?: string | null;
};
