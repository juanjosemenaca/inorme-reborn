-- Grupo Legal: expedientes, clientes jurídicos, documentación, procedimientos,
-- facturación interna del despacho, tiempos, agenda y auditoría.
-- Independiente de public.clients / billing_invoices (facturación fiscal VeriFactu).

-- ---------------------------------------------------------------------------
-- Módulo habilitado por usuario (trabajador / admin con ficha)
-- ---------------------------------------------------------------------------
ALTER TABLE public.backoffice_users
  DROP CONSTRAINT IF EXISTS backoffice_users_enabled_modules_valid;

ALTER TABLE public.backoffice_users
  ADD CONSTRAINT backoffice_users_enabled_modules_valid
  CHECK (
    enabled_modules <@ ARRAY[
      'VACATIONS',
      'MESSAGES',
      'TIME_CLOCK',
      'AGENDA',
      'GASTOS',
      'LEGAL'
    ]::text[]
  );

-- ---------------------------------------------------------------------------
-- Clientes del despacho (CRM legal; no confundir con public.clients)
-- ---------------------------------------------------------------------------
CREATE TABLE public.legal_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  tax_id text NOT NULL,
  fiscal_address text NOT NULL DEFAULT '',
  client_type text NOT NULL CHECK (client_type IN ('COMPANY', 'INDIVIDUAL')),
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_legal_clients_active ON public.legal_clients (active, created_at DESC);
CREATE INDEX idx_legal_clients_tax_id ON public.legal_clients (tax_id);

CREATE TRIGGER tr_legal_clients_updated_at
  BEFORE UPDATE ON public.legal_clients
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

COMMENT ON TABLE public.legal_clients IS
  'Clientes de cartera legal (empresa o particular).';

-- Vínculos entre clientes (matriz/filial, grupo, etc.)
CREATE TABLE public.legal_client_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_client_id uuid NOT NULL REFERENCES public.legal_clients (id) ON DELETE CASCADE,
  to_client_id uuid NOT NULL REFERENCES public.legal_clients (id) ON DELETE CASCADE,
  link_role text NOT NULL DEFAULT 'RELATED',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_legal_client_links_distinct CHECK (from_client_id <> to_client_id),
  CONSTRAINT uq_legal_client_link UNIQUE (from_client_id, to_client_id)
);

CREATE INDEX idx_legal_client_links_from ON public.legal_client_links (from_client_id);
CREATE INDEX idx_legal_client_links_to ON public.legal_client_links (to_client_id);

-- Contactos de un cliente legal
CREATE TABLE public.legal_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_client_id uuid NOT NULL REFERENCES public.legal_clients (id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL DEFAULT '',
  mobile text NOT NULL DEFAULT '',
  position text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_legal_contacts_client ON public.legal_contacts (legal_client_id);

CREATE TRIGGER tr_legal_contacts_updated_at
  BEFORE UPDATE ON public.legal_contacts
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Expedientes (núcleo)
-- ---------------------------------------------------------------------------
CREATE TABLE public.legal_matters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_client_id uuid NOT NULL REFERENCES public.legal_clients (id) ON DELETE RESTRICT,
  matter_code text,
  matter_type text NOT NULL CHECK (
    matter_type IN (
      'MERCANTIL',
      'FISCAL',
      'LITIGIO',
      'LABORAL',
      'CIVIL',
      'ADMINISTRATIVO',
      'OTHER'
    )
  ),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'CLOSED')),
  responsible_lawyer_id uuid REFERENCES public.backoffice_users (id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  opened_at date,
  closed_at timestamptz,
  key_dates jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by_backoffice_user_id uuid REFERENCES public.backoffice_users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_legal_matters_code ON public.legal_matters (matter_code)
  WHERE matter_code IS NOT NULL AND btrim(matter_code) <> '';

CREATE INDEX idx_legal_matters_client ON public.legal_matters (legal_client_id, status);
CREATE INDEX idx_legal_matters_lawyer ON public.legal_matters (responsible_lawyer_id);
CREATE INDEX idx_legal_matters_status ON public.legal_matters (status, updated_at DESC);

CREATE TRIGGER tr_legal_matters_updated_at
  BEFORE UPDATE ON public.legal_matters
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

COMMENT ON TABLE public.legal_matters IS
  'Expediente legal: centro de relación con documentos, facturas internas, tiempos y agenda.';

-- Actuaciones / timeline
CREATE TABLE public.legal_matter_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid NOT NULL REFERENCES public.legal_matters (id) ON DELETE CASCADE,
  activity_type text NOT NULL DEFAULT 'NOTE',
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by_backoffice_user_id uuid REFERENCES public.backoffice_users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_legal_matter_activities_matter ON public.legal_matter_activities (matter_id, occurred_at DESC);

-- Documentación
CREATE TABLE public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid NOT NULL REFERENCES public.legal_matters (id) ON DELETE CASCADE,
  name text NOT NULL,
  doc_type text NOT NULL DEFAULT 'OTHER',
  version int NOT NULL DEFAULT 1 CHECK (version >= 1),
  storage_bucket text NOT NULL DEFAULT 'legal-documents',
  storage_path text NOT NULL,
  mime_type text NOT NULL DEFAULT '',
  file_size bigint,
  uploaded_by_backoffice_user_id uuid REFERENCES public.backoffice_users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_legal_documents_matter ON public.legal_documents (matter_id, created_at DESC);

CREATE TRIGGER tr_legal_documents_updated_at
  BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Procedimientos judiciales
CREATE TABLE public.legal_procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid NOT NULL REFERENCES public.legal_matters (id) ON DELETE CASCADE,
  court_name text NOT NULL DEFAULT '',
  procedure_number text NOT NULL DEFAULT '',
  procedural_status text NOT NULL DEFAULT '',
  key_dates jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_legal_procedures_matter ON public.legal_procedures (matter_id);

CREATE TRIGGER tr_legal_procedures_updated_at
  BEFORE UPDATE ON public.legal_procedures
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Facturación interna del expediente (no sustituye billing_invoices / VeriFactu)
CREATE TABLE public.legal_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid REFERENCES public.legal_matters (id) ON DELETE SET NULL,
  legal_client_id uuid NOT NULL REFERENCES public.legal_clients (id) ON DELETE RESTRICT,
  invoice_number text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ISSUED', 'PAID')),
  billing_model text NOT NULL DEFAULT 'HOURLY' CHECK (
    billing_model IN ('HOURLY', 'FIXED', 'MONTHLY_RETAINER')
  ),
  issue_date date,
  due_date date,
  currency text NOT NULL DEFAULT 'EUR',
  subtotal numeric(14, 2) NOT NULL DEFAULT 0,
  tax_total numeric(14, 2) NOT NULL DEFAULT 0,
  grand_total numeric(14, 2) NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  created_by_backoffice_user_id uuid REFERENCES public.backoffice_users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_legal_invoices_client ON public.legal_invoices (legal_client_id, created_at DESC);
CREATE INDEX idx_legal_invoices_matter ON public.legal_invoices (matter_id);
CREATE INDEX idx_legal_invoices_status ON public.legal_invoices (status);

CREATE TRIGGER tr_legal_invoices_updated_at
  BEFORE UPDATE ON public.legal_invoices
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TABLE public.legal_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.legal_invoices (id) ON DELETE CASCADE,
  line_order int NOT NULL,
  line_type text NOT NULL CHECK (line_type IN ('HOURLY', 'FIXED', 'MONTHLY_RETAINER')),
  description text NOT NULL,
  quantity numeric(14, 4) NOT NULL DEFAULT 1,
  unit_price numeric(14, 4) NOT NULL DEFAULT 0,
  line_total numeric(14, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_legal_invoice_line_order UNIQUE (invoice_id, line_order)
);

CREATE TRIGGER tr_legal_invoice_lines_updated_at
  BEFORE UPDATE ON public.legal_invoice_lines
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Timesheets legales
CREATE TABLE public.legal_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid NOT NULL REFERENCES public.legal_matters (id) ON DELETE CASCADE,
  backoffice_user_id uuid NOT NULL REFERENCES public.backoffice_users (id) ON DELETE CASCADE,
  work_date date NOT NULL,
  hours numeric(10, 2) NOT NULL CHECK (hours > 0),
  description text NOT NULL DEFAULT '',
  billable boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_legal_time_matter ON public.legal_time_entries (matter_id, work_date DESC);
CREATE INDEX idx_legal_time_user ON public.legal_time_entries (backoffice_user_id, work_date DESC);

CREATE TRIGGER tr_legal_time_entries_updated_at
  BEFORE UPDATE ON public.legal_time_entries
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Agenda / plazos
CREATE TABLE public.legal_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid REFERENCES public.legal_matters (id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('HEARING', 'DEADLINE', 'MEETING', 'OTHER')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  reminder_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  created_by_backoffice_user_id uuid REFERENCES public.backoffice_users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_legal_calendar_starts ON public.legal_calendar_events (starts_at);
CREATE INDEX idx_legal_calendar_matter ON public.legal_calendar_events (matter_id);

CREATE TRIGGER tr_legal_calendar_events_updated_at
  BEFORE UPDATE ON public.legal_calendar_events
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Auditoría (acciones de usuario; ampliar desde aplicación)
CREATE TABLE public.legal_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  backoffice_user_id uuid REFERENCES public.backoffice_users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_legal_audit_entity ON public.legal_audit_logs (entity_type, entity_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Storage: documentos legales (privado, mismo patrón que project-documents)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'legal-documents',
  'legal-documents',
  false,
  52428800,
  NULL
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "legal_documents_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "legal_documents_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "legal_documents_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "legal_documents_delete_authenticated" ON storage.objects;

CREATE POLICY "legal_documents_select_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'legal-documents');

CREATE POLICY "legal_documents_insert_authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'legal-documents');

CREATE POLICY "legal_documents_update_authenticated"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'legal-documents')
  WITH CHECK (bucket_id = 'legal-documents');

CREATE POLICY "legal_documents_delete_authenticated"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'legal-documents');

-- ---------------------------------------------------------------------------
-- RLS: usuarios autenticados backoffice (mismo criterio que resto de módulos)
-- ---------------------------------------------------------------------------
ALTER TABLE public.legal_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_client_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_matters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_matter_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legal_authenticated_all_legal_clients"
  ON public.legal_clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "legal_authenticated_all_legal_client_links"
  ON public.legal_client_links FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "legal_authenticated_all_legal_contacts"
  ON public.legal_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "legal_authenticated_all_legal_matters"
  ON public.legal_matters FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "legal_authenticated_all_legal_matter_activities"
  ON public.legal_matter_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "legal_authenticated_all_legal_documents"
  ON public.legal_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "legal_authenticated_all_legal_procedures"
  ON public.legal_procedures FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "legal_authenticated_all_legal_invoices"
  ON public.legal_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "legal_authenticated_all_legal_invoice_lines"
  ON public.legal_invoice_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "legal_authenticated_all_legal_time_entries"
  ON public.legal_time_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "legal_authenticated_all_legal_calendar_events"
  ON public.legal_calendar_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "legal_authenticated_all_legal_audit_logs"
  ON public.legal_audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.legal_clients TO authenticated;
GRANT ALL ON public.legal_client_links TO authenticated;
GRANT ALL ON public.legal_contacts TO authenticated;
GRANT ALL ON public.legal_matters TO authenticated;
GRANT ALL ON public.legal_matter_activities TO authenticated;
GRANT ALL ON public.legal_documents TO authenticated;
GRANT ALL ON public.legal_procedures TO authenticated;
GRANT ALL ON public.legal_invoices TO authenticated;
GRANT ALL ON public.legal_invoice_lines TO authenticated;
GRANT ALL ON public.legal_time_entries TO authenticated;
GRANT ALL ON public.legal_calendar_events TO authenticated;
GRANT ALL ON public.legal_audit_logs TO authenticated;

NOTIFY pgrst, 'reload schema';
