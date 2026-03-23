-- Inorme — esquema inicial (alineado con src/types/*.ts)
-- Ejecutar en Supabase: SQL Editor → New query → Run
-- Contraseñas: usa Supabase Auth; esta tabla no guarda password en claro.

-- ---------------------------------------------------------------------------
-- Extensiones
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------------
CREATE TYPE public.user_role AS ENUM ('ADMIN', 'WORKER');

CREATE TYPE public.employment_type AS ENUM (
  'FIJO',
  'TEMPORAL',
  'AUTONOMO',
  'PRACTICAS',
  'SUBCONTRATADO'
);

CREATE TYPE public.client_kind AS ENUM ('FINAL', 'INTERMEDIARIO');

CREATE TYPE public.autonomo_via AS ENUM ('CUENTA_PROPIA', 'EMPRESA');

-- ---------------------------------------------------------------------------
-- Proveedores
-- ---------------------------------------------------------------------------
CREATE TABLE public.providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_name text NOT NULL,
  company_name text NOT NULL,
  cif text NOT NULL,
  fiscal_address text NOT NULL,
  phone text NOT NULL DEFAULT '',
  contact_email text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_providers_cif ON public.providers (cif);
CREATE INDEX idx_providers_active ON public.providers (active);

-- ---------------------------------------------------------------------------
-- Trabajadores de empresa (fichas)
-- ---------------------------------------------------------------------------
CREATE TABLE public.company_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  dni text NOT NULL,
  email text NOT NULL DEFAULT '',
  mobile text NOT NULL DEFAULT '',
  postal_address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  employment_type public.employment_type NOT NULL DEFAULT 'FIJO',
  provider_id uuid REFERENCES public.providers (id) ON DELETE SET NULL,
  autonomo_via public.autonomo_via,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_workers_autonomo_via_ck CHECK (
    (employment_type = 'AUTONOMO' AND autonomo_via IS NOT NULL)
    OR (employment_type <> 'AUTONOMO' AND autonomo_via IS NULL)
  )
);

CREATE INDEX idx_company_workers_provider ON public.company_workers (provider_id);
CREATE INDEX idx_company_workers_active ON public.company_workers (active);

-- ---------------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------------
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_name text NOT NULL,
  company_name text NOT NULL,
  cif text NOT NULL,
  fiscal_address text NOT NULL,
  client_kind public.client_kind NOT NULL DEFAULT 'FINAL',
  linked_final_client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  phone text NOT NULL DEFAULT '',
  contact_email text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clients_linked_ck CHECK (
    (client_kind = 'FINAL' AND linked_final_client_id IS NULL)
    OR client_kind = 'INTERMEDIARIO'
  )
);

CREATE INDEX idx_clients_kind ON public.clients (client_kind);
CREATE INDEX idx_clients_linked_final ON public.clients (linked_final_client_id);
CREATE INDEX idx_clients_cif ON public.clients (cif);

-- ---------------------------------------------------------------------------
-- Personas de contacto (clientes)
-- ---------------------------------------------------------------------------
CREATE TABLE public.client_contact_persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL DEFAULT '',
  mobile text NOT NULL DEFAULT '',
  position text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT ''
);

CREATE INDEX idx_client_contacts_client ON public.client_contact_persons (client_id);

-- ---------------------------------------------------------------------------
-- Personas de contacto (proveedores)
-- ---------------------------------------------------------------------------
CREATE TABLE public.provider_contact_persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers (id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL DEFAULT '',
  mobile text NOT NULL DEFAULT '',
  position text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT ''
);

CREATE INDEX idx_provider_contacts_provider ON public.provider_contact_persons (provider_id);

-- ---------------------------------------------------------------------------
-- Usuarios backoffice (perfil; credenciales en auth.users al usar Supabase Auth)
-- ---------------------------------------------------------------------------
CREATE TABLE public.backoffice_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role public.user_role NOT NULL DEFAULT 'WORKER',
  company_worker_id uuid REFERENCES public.company_workers (id) ON DELETE SET NULL,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  dni text NOT NULL DEFAULT '',
  mobile text NOT NULL DEFAULT '',
  postal_address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  employment_type public.employment_type NOT NULL DEFAULT 'FIJO',
  active boolean NOT NULL DEFAULT true,
  auth_user_id uuid UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_backoffice_users_company_worker ON public.backoffice_users (company_worker_id);
CREATE INDEX idx_backoffice_users_auth ON public.backoffice_users (auth_user_id);

COMMENT ON TABLE public.backoffice_users IS
  'Perfil backoffice. Vincular auth_user_id con auth.users tras signup/login.';

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_providers_updated_at
  BEFORE UPDATE ON public.providers
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER tr_company_workers_updated_at
  BEFORE UPDATE ON public.company_workers
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER tr_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER tr_backoffice_users_updated_at
  BEFORE UPDATE ON public.backoffice_users
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security (ajusta políticas en producción)
-- ---------------------------------------------------------------------------
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contact_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_contact_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backoffice_users ENABLE ROW LEVEL SECURITY;

-- Desarrollo: usuarios autenticados con Supabase Auth pueden todo.
-- Sustituye por políticas por rol (p. ej. solo ADMIN) antes de producción.
CREATE POLICY "backoffice_authenticated_all_providers"
  ON public.providers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "backoffice_authenticated_all_company_workers"
  ON public.company_workers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "backoffice_authenticated_all_clients"
  ON public.clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "backoffice_authenticated_all_client_contacts"
  ON public.client_contact_persons FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "backoffice_authenticated_all_provider_contacts"
  ON public.provider_contact_persons FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "backoffice_authenticated_all_backoffice_users"
  ON public.backoffice_users FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Grants (Supabase)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
