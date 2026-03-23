/**
 * Filas Postgres (snake_case) alineadas con
 * `supabase/migrations/20260206120000_initial_schema.sql`.
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

/** Perfil backoffice (sin contraseña; Auth en `auth.users`). */
export type BackofficeUserInsert = Omit<
  BackofficeUserRow,
  "id" | "created_at" | "updated_at" | "auth_user_id"
> & {
  id?: string;
  auth_user_id?: string | null;
};
