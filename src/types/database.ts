/**
 * Filas Postgres (snake_case) alineadas con
 * Migraciones en `supabase/migrations/` (incl. proyectos, equipo en proyecto, calendarios laborales).
 * Úsalas con PostgREST / `supabase.from(...)` y mapea a `src/types/*.ts` con `@/lib/supabase/mappers`.
 */

export type DbUserRole = "ADMIN" | "WORKER";
export type DbWorkerModuleKey = "VACATIONS" | "MESSAGES" | "TIME_CLOCK" | "AGENDA" | "GASTOS";

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
  postal_address: string;
  fiscal_address: string;
  client_kind: DbClientKind;
  linked_final_client_id: string | null;
  phone: string;
  contact_email: string;
  /** Sitio web público (opcional). */
  website_url: string;
  notes: string;
  /** Destinatarios de facturación (texto libre). */
  invoice_addressee_line?: string | null;
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
  contact_purpose: string;
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
  /** Solo CLOCK_IN; IP pública capturada en el cliente. */
  clock_in_client_ip?: string | null;
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
  completed_at: string | null;
  completed_by_backoffice_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export type DbWorkerExpensePeriodKind = "MONTH" | "CUSTOM";
export type DbWorkerExpenseSheetStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

export interface WorkerExpenseSheetRow {
  id: string;
  company_worker_id: string;
  period_kind: DbWorkerExpensePeriodKind;
  calendar_year: number | null;
  calendar_month: number | null;
  period_start: string;
  period_end: string;
  status: DbWorkerExpenseSheetStatus;
  observations: string;
  submitted_at: string | null;
  reviewed_by_backoffice_user_id: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  pdf_storage_path: string | null;
  pdf_generated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkerExpenseSheetAttachmentRow {
  id: string;
  sheet_id: string;
  expense_date: string | null;
  storage_path: string;
  original_filename: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  created_at: string;
  created_by_backoffice_user_id: string | null;
}

export interface WorkerExpenseSheetLineRow {
  id: string;
  sheet_id: string;
  expense_date: string;
  amount_tickets: string;
  amount_taxis_parking: string;
  amount_kms_fuel: string;
  amount_toll: string;
  amount_per_diem: string;
  amount_hotel: string;
  amount_supplies: string;
  amount_other: string;
  created_at: string;
  updated_at: string;
}

export type DbBillingInvoiceStatus = "DRAFT" | "ISSUED" | "PAID" | "CANCELLED";
export type DbBillingPaymentStatus = "PENDING" | "PARTIAL" | "PAID";
export type DbBillingInvoiceKind = "NORMAL" | "RECTIFICATIVE";
export type DbBillingLineType = "BILLABLE" | "BLOCK_TITLE" | "BLOCK_SUBTITLE" | "CONCEPT";

export interface BillingSeriesRow {
  id: string;
  issuer_id: string;
  code: string;
  label: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BillingIssuerRow {
  id: string;
  code: string;
  legal_name: string;
  tax_id: string;
  fiscal_address: string;
  bank_account_iban: string | null;
  bank_account_swift: string | null;
  bank_name: string | null;
  email: string | null;
  phone: string | null;
  logo_storage_path: string | null;
  website_url: string | null;
  /** Texto opcional pie PDF (protección de datos); INORME usa bloque fijo por CIF en cliente. */
  privacy_footer_text: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BillingInvoiceRow {
  id: string;
  series_id: string;
  issuer_id: string;
  fiscal_year: number | null;
  invoice_number: number | null;
  status: DbBillingInvoiceStatus;
  payment_status: DbBillingPaymentStatus;
  invoice_kind: DbBillingInvoiceKind;
  rectifies_invoice_id: string | null;
  issue_date: string | null;
  issued_at: string | null;
  due_date: string | null;
  notes: string;
  client_id: string;
  issuer_name: string;
  issuer_tax_id: string;
  issuer_fiscal_address: string;
  issuer_bank_account_iban: string | null;
  issuer_bank_account_swift: string | null;
  issuer_bank_name: string | null;
  issuer_logo_storage_path: string | null;
  issuer_website_url: string | null;
  issuer_privacy_footer: string | null;
  issuer_email: string | null;
  issuer_phone: string | null;
  recipient_name: string;
  recipient_tax_id: string;
  recipient_fiscal_address: string;
  recipient_website_url: string | null;
  recipient_addressee_line?: string | null;
  taxable_base_total: string;
  vat_total: string;
  irpf_total: string;
  grand_total: string;
  collected_total: string;
  previous_hash: string | null;
  record_hash: string | null;
  verifactu_qr_payload: Record<string, unknown> | null;
  verifactu_submission_status: "PENDING" | "SENT" | "ACCEPTED" | "REJECTED";
  created_by_backoffice_user_id: string | null;
  updated_by_backoffice_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingInvoiceLineRow {
  id: string;
  invoice_id: string;
  line_order: number;
  line_type: DbBillingLineType;
  description: string;
  quantity: string;
  unit_price: string;
  billable_hours_percent?: string;
  vat_rate: string;
  irpf_rate: string;
  taxable_base: string;
  vat_amount: string;
  irpf_amount: string;
  line_total: string;
  created_at: string;
  updated_at: string;
}

export interface BillingReceiptRow {
  id: string;
  invoice_id: string;
  receipt_date: string;
  amount: string;
  method: string;
  reference: string | null;
  notes: string;
  created_by_backoffice_user_id: string | null;
  created_at: string;
}

export interface BillingAuditLogRow {
  id: string;
  entity_type: string;
  entity_id: string | null;
  event_type: string;
  event_payload: Record<string, unknown>;
  actor_backoffice_user_id: string | null;
  created_at: string;
}

/** Perfil backoffice (sin contraseña; Auth en `auth.users`). */
export type BackofficeUserInsert = Omit<
  BackofficeUserRow,
  "id" | "created_at" | "updated_at" | "auth_user_id"
> & {
  id?: string;
  auth_user_id?: string | null;
};
