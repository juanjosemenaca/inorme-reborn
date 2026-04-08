/**
 * Filas Postgres (snake_case) alineadas con
 * Migraciones en `supabase/migrations/` (incl. proyectos, equipo en proyecto, calendarios laborales).
 * Úsalas con PostgREST / `supabase.from(...)` y mapea a `src/types/*.ts` con `@/lib/supabase/mappers`.
 */

export type DbUserRole = "ADMIN" | "WORKER";
export type DbWorkerModuleKey = "VACATIONS" | "MESSAGES" | "TIME_CLOCK" | "AGENDA";

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
  work_calendar_site_id: string;
  vacation_days: number;
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

export type DbWorkerProfileChangeStatus = "PENDING" | "APPROVED" | "REJECTED";
export type DbWorkerVacationChangeStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface WorkerProfileChangeRequestRow {
  id: string;
  company_worker_id: string;
  backoffice_user_id: string;
  status: DbWorkerProfileChangeStatus;
  worker_message: string;
  suggested: Record<string, unknown>;
  previous_snapshot: Record<string, unknown> | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkerVacationChangeRequestRow {
  id: string;
  company_worker_id: string;
  backoffice_user_id: string;
  calendar_year: number;
  status: DbWorkerVacationChangeStatus;
  worker_message: string;
  proposed_dates: unknown;
  previous_approved_dates: unknown;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
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
  /** Si true, debe cambiar contraseña antes de usar el backoffice (salvo pantalla dedicada). */
  must_change_password: boolean;
  /** Último cambio de contraseña registrado en la app (Auth). */
  password_changed_at: string | null;
  enabled_modules: DbWorkerModuleKey[];
  created_at: string;
  updated_at: string;
}

export interface BackofficeMessageRow {
  id: string;
  sender_backoffice_user_id: string | null;
  recipient_backoffice_user_id: string;
  thread_id: string;
  thread_title: string | null;
  category: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
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

export type DbWorkCalendarHolidayKind = "NACIONAL" | "AUTONOMICO" | "LOCAL";

export interface WorkCalendarSiteRow {
  id: string;
  slug: string;
  name: string;
  vacation_days_default: number;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkCalendarHolidayRow {
  id: string;
  calendar_year: number;
  site_id: string;
  holiday_date: string;
  holiday_kind: DbWorkCalendarHolidayKind;
  label: string;
  created_at: string;
  updated_at: string;
}

export interface WorkCalendarSummerRangeRow {
  id: string;
  calendar_year: number;
  site_id: string;
  date_start: string;
  date_end: string;
  label: string;
  created_at: string;
  updated_at: string;
}

export interface CompanyWorkerVacationDayRow {
  id: string;
  company_worker_id: string;
  vacation_date: string;
  created_at: string;
  updated_at: string;
}

export interface CompanyWorkerVacationDayNotificationRow {
  id: string;
  company_worker_id: string;
  calendar_year: number;
  vacation_date_added: string;
  created_at: string;
}

export type DbWorkerTimeClockEventKind =
  | "CLOCK_IN"
  | "CLOCK_OUT"
  | "BREAK_START"
  | "BREAK_END"
  | "ABSENCE";

export type DbWorkerTimeClockSource = "WORKER" | "ADMIN";

export interface WorkerTimeClockEventRow {
  id: string;
  company_worker_id: string;
  event_kind: DbWorkerTimeClockEventKind;
  event_at: string;
  absence_reason: string | null;
  comment: string;
  source: DbWorkerTimeClockSource;
  created_by_backoffice_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkerAgendaItemRow {
  id: string;
  company_worker_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  item_type: string;
  source: string;
  created_by_backoffice_user_id: string | null;
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
