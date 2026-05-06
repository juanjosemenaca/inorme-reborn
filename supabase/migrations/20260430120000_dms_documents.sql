-- DMS (gestor documental): documentos lógicos, versiones inmutables en Storage, permisos y auditoría.
-- Expediente = public.projects. Almacenamiento: bucket dedicado `dms-documents`.

-- ---------------------------------------------------------------------------
-- Bucket Storage
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dms-documents',
  'dms-documents',
  false,
  104857600,
  NULL
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "dms_objects_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "dms_objects_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "dms_objects_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "dms_objects_delete_authenticated" ON storage.objects;

CREATE POLICY "dms_objects_select_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dms-documents');

CREATE POLICY "dms_objects_insert_authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dms-documents');

CREATE POLICY "dms_objects_update_authenticated"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'dms-documents')
  WITH CHECK (bucket_id = 'dms-documents');

CREATE POLICY "dms_objects_delete_authenticated"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dms-documents');

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
CREATE TABLE public.dms_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  document_type text NOT NULL DEFAULT 'OTHER',
  client_id uuid,
  project_id uuid,
  current_version_id uuid,
  created_by_backoffice_user_id uuid NOT NULL,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  search_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dms_documents_type_check CHECK (
    document_type IN (
      'CONTRACT',
      'INVOICE',
      'REPORT',
      'CORRESPONDENCE',
      'CERTIFICATE',
      'PLEADING',
      'OTHER'
    )
  )
);

CREATE INDEX idx_dms_documents_client ON public.dms_documents (client_id, updated_at DESC);
CREATE INDEX idx_dms_documents_project ON public.dms_documents (project_id, updated_at DESC);
CREATE INDEX idx_dms_documents_type ON public.dms_documents (document_type, updated_at DESC);
CREATE INDEX idx_dms_documents_created_by ON public.dms_documents (created_by_backoffice_user_id);
CREATE INDEX idx_dms_documents_tags ON public.dms_documents USING GIN (tags);

CREATE INDEX idx_dms_documents_search ON public.dms_documents
  USING GIN (
    to_tsvector(
      'simple',
      coalesce(name, '')
        || ' '
        || coalesce(description, '')
        || ' '
        || coalesce(search_text, '')
    )
  );

COMMENT ON TABLE public.dms_documents IS
  'Documento lógico (metadatos). Ficheros en versiones; no sobrescribir blobs: siempre nueva fila en dms_document_versions.';

CREATE TABLE public.dms_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.dms_documents (id) ON DELETE CASCADE,
  version_number int NOT NULL,
  storage_path text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT '',
  original_filename text NOT NULL DEFAULT '',
  comment text NOT NULL DEFAULT '',
  created_by_backoffice_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_dms_version_per_doc UNIQUE (document_id, version_number),
  CONSTRAINT uq_dms_version_storage_path UNIQUE (storage_path),
  CONSTRAINT dms_version_number_positive CHECK (version_number >= 1)
);

CREATE INDEX idx_dms_versions_document ON public.dms_document_versions (document_id, version_number DESC);

COMMENT ON TABLE public.dms_document_versions IS
  'Versión inmutable: cada subida crea fila nueva y objeto nuevo en Storage.';

ALTER TABLE public.dms_documents
  ADD CONSTRAINT dms_documents_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES public.dms_document_versions (id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.dms_touch_document_on_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.dms_documents
  SET updated_at = now()
  WHERE id = NEW.document_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_dms_version_touch_document
  AFTER INSERT ON public.dms_document_versions
  FOR EACH ROW EXECUTE PROCEDURE public.dms_touch_document_on_version();

CREATE TABLE public.dms_document_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.dms_documents (id) ON DELETE CASCADE,
  backoffice_user_id uuid NOT NULL,
  permission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dms_perm_level_check CHECK (permission IN ('READ', 'WRITE', 'ADMIN')),
  CONSTRAINT uq_dms_perm_user UNIQUE (document_id, backoffice_user_id)
);

CREATE INDEX idx_dms_perm_user ON public.dms_document_permissions (backoffice_user_id);

CREATE TABLE public.dms_document_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.dms_documents (id) ON DELETE SET NULL,
  backoffice_user_id uuid,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dms_log_action_check CHECK (
    action IN (
      'CREATE',
      'UPDATE_METADATA',
      'VERSION_UPLOAD',
      'DOWNLOAD',
      'DELETE',
      'PERMISSION_GRANT',
      'PERMISSION_REVOKE'
    )
  )
);

CREATE INDEX idx_dms_logs_document ON public.dms_document_logs (document_id, created_at DESC);

-- Claves foráneas opcionales (intranet / CRM ya migrado)
DO $dms_fk$
BEGIN
  IF to_regclass('public.clients') IS NOT NULL THEN
    ALTER TABLE public.dms_documents
      DROP CONSTRAINT IF EXISTS dms_documents_client_id_fkey;
    ALTER TABLE public.dms_documents
      ADD CONSTRAINT dms_documents_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients (id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.projects') IS NOT NULL THEN
    ALTER TABLE public.dms_documents
      DROP CONSTRAINT IF EXISTS dms_documents_project_id_fkey;
    ALTER TABLE public.dms_documents
      ADD CONSTRAINT dms_documents_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES public.projects (id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.backoffice_users') IS NOT NULL THEN
    ALTER TABLE public.dms_documents
      DROP CONSTRAINT IF EXISTS dms_documents_created_by_fkey;
    ALTER TABLE public.dms_documents
      ADD CONSTRAINT dms_documents_created_by_fkey
      FOREIGN KEY (created_by_backoffice_user_id) REFERENCES public.backoffice_users (id) ON DELETE SET NULL;

    ALTER TABLE public.dms_document_versions
      DROP CONSTRAINT IF EXISTS dms_document_versions_created_by_fkey;
    ALTER TABLE public.dms_document_versions
      ADD CONSTRAINT dms_document_versions_created_by_fkey
      FOREIGN KEY (created_by_backoffice_user_id) REFERENCES public.backoffice_users (id) ON DELETE SET NULL;

    ALTER TABLE public.dms_document_permissions
      DROP CONSTRAINT IF EXISTS dms_document_permissions_user_fkey;
    ALTER TABLE public.dms_document_permissions
      ADD CONSTRAINT dms_document_permissions_user_fkey
      FOREIGN KEY (backoffice_user_id) REFERENCES public.backoffice_users (id) ON DELETE CASCADE;

    ALTER TABLE public.dms_document_logs
      DROP CONSTRAINT IF EXISTS dms_document_logs_user_fkey;
    ALTER TABLE public.dms_document_logs
      ADD CONSTRAINT dms_document_logs_user_fkey
      FOREIGN KEY (backoffice_user_id) REFERENCES public.backoffice_users (id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$dms_fk$;

-- updated_at en documentos (requiere migración base con public.set_updated_at)
DO $dms_trig$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'set_updated_at'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgrelid = 'public.dms_documents'::regclass
        AND tgname = 'tr_dms_documents_updated_at'
    ) THEN
      CREATE TRIGGER tr_dms_documents_updated_at
        BEFORE UPDATE ON public.dms_documents
        FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
    END IF;
  END IF;
END;
$dms_trig$;

-- RLS: sin public.backoffice_users → política permisiva (mismo criterio que adjuntos simples).
-- Con intranet → funciones + políticas por rol, permiso explícito y (si existe) miembro de proyecto.
ALTER TABLE public.dms_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dms_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dms_document_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dms_document_logs ENABLE ROW LEVEL SECURITY;

DO $dms_rls$
DECLARE
  has_bo boolean := to_regclass('public.backoffice_users') IS NOT NULL;
  has_pm boolean := to_regclass('public.project_members') IS NOT NULL;
BEGIN
  DROP POLICY IF EXISTS "dms_documents_select" ON public.dms_documents;
  DROP POLICY IF EXISTS "dms_documents_insert" ON public.dms_documents;
  DROP POLICY IF EXISTS "dms_documents_update" ON public.dms_documents;
  DROP POLICY IF EXISTS "dms_documents_delete" ON public.dms_documents;
  DROP POLICY IF EXISTS "dms_documents_authenticated_all" ON public.dms_documents;

  DROP POLICY IF EXISTS "dms_versions_select" ON public.dms_document_versions;
  DROP POLICY IF EXISTS "dms_versions_insert" ON public.dms_document_versions;
  DROP POLICY IF EXISTS "dms_versions_delete" ON public.dms_document_versions;
  DROP POLICY IF EXISTS "dms_versions_authenticated_all" ON public.dms_document_versions;

  DROP POLICY IF EXISTS "dms_perm_select" ON public.dms_document_permissions;
  DROP POLICY IF EXISTS "dms_perm_insert" ON public.dms_document_permissions;
  DROP POLICY IF EXISTS "dms_perm_update" ON public.dms_document_permissions;
  DROP POLICY IF EXISTS "dms_perm_delete" ON public.dms_document_permissions;
  DROP POLICY IF EXISTS "dms_perm_authenticated_all" ON public.dms_document_permissions;

  DROP POLICY IF EXISTS "dms_logs_select" ON public.dms_document_logs;
  DROP POLICY IF EXISTS "dms_logs_insert" ON public.dms_document_logs;
  DROP POLICY IF EXISTS "dms_logs_authenticated_all" ON public.dms_document_logs;

  IF NOT has_bo THEN
    CREATE POLICY "dms_documents_authenticated_all"
      ON public.dms_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "dms_versions_authenticated_all"
      ON public.dms_document_versions FOR ALL TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "dms_perm_authenticated_all"
      ON public.dms_document_permissions FOR ALL TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "dms_logs_authenticated_all"
      ON public.dms_document_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
    RETURN;
  END IF;

  CREATE OR REPLACE FUNCTION public.dms_current_backoffice_user_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $sf$
    SELECT bu.id
    FROM public.backoffice_users bu
    WHERE bu.auth_user_id = auth.uid()
    LIMIT 1;
  $sf$;

  CREATE OR REPLACE FUNCTION public.dms_is_backoffice_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $sf$
    SELECT EXISTS (
      SELECT 1
      FROM public.backoffice_users bu
      WHERE bu.auth_user_id = auth.uid()
        AND bu.role = 'ADMIN'
    );
  $sf$;

  IF has_pm THEN
    CREATE OR REPLACE FUNCTION public.dms_can_read_document(p_document_id uuid)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $sf$
      SELECT
        public.dms_is_backoffice_admin()
        OR EXISTS (
          SELECT 1 FROM public.dms_documents d
          WHERE d.id = p_document_id
            AND d.created_by_backoffice_user_id = public.dms_current_backoffice_user_id()
        )
        OR EXISTS (
          SELECT 1 FROM public.dms_document_permissions p
          WHERE p.document_id = p_document_id
            AND p.backoffice_user_id = public.dms_current_backoffice_user_id()
            AND p.permission IN ('READ', 'WRITE', 'ADMIN')
        )
        OR EXISTS (
          SELECT 1
          FROM public.dms_documents d
          JOIN public.project_members pm ON pm.project_id = d.project_id
          JOIN public.backoffice_users bu ON bu.id = public.dms_current_backoffice_user_id()
          WHERE d.id = p_document_id
            AND d.project_id IS NOT NULL
            AND bu.company_worker_id IS NOT NULL
            AND pm.company_worker_id = bu.company_worker_id
        );
    $sf$;

    CREATE OR REPLACE FUNCTION public.dms_can_write_document(p_document_id uuid)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $sf$
      SELECT
        public.dms_is_backoffice_admin()
        OR EXISTS (
          SELECT 1 FROM public.dms_documents d
          WHERE d.id = p_document_id
            AND d.created_by_backoffice_user_id = public.dms_current_backoffice_user_id()
        )
        OR EXISTS (
          SELECT 1 FROM public.dms_document_permissions p
          WHERE p.document_id = p_document_id
            AND p.backoffice_user_id = public.dms_current_backoffice_user_id()
            AND p.permission IN ('WRITE', 'ADMIN')
        )
        OR EXISTS (
          SELECT 1
          FROM public.dms_documents d
          JOIN public.project_members pm ON pm.project_id = d.project_id
          JOIN public.backoffice_users bu ON bu.id = public.dms_current_backoffice_user_id()
          WHERE d.id = p_document_id
            AND d.project_id IS NOT NULL
            AND bu.company_worker_id IS NOT NULL
            AND pm.company_worker_id = bu.company_worker_id
        );
    $sf$;
  ELSE
    CREATE OR REPLACE FUNCTION public.dms_can_read_document(p_document_id uuid)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $sf$
      SELECT
        public.dms_is_backoffice_admin()
        OR EXISTS (
          SELECT 1 FROM public.dms_documents d
          WHERE d.id = p_document_id
            AND d.created_by_backoffice_user_id = public.dms_current_backoffice_user_id()
        )
        OR EXISTS (
          SELECT 1 FROM public.dms_document_permissions p
          WHERE p.document_id = p_document_id
            AND p.backoffice_user_id = public.dms_current_backoffice_user_id()
            AND p.permission IN ('READ', 'WRITE', 'ADMIN')
        );
    $sf$;

    CREATE OR REPLACE FUNCTION public.dms_can_write_document(p_document_id uuid)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $sf$
      SELECT
        public.dms_is_backoffice_admin()
        OR EXISTS (
          SELECT 1 FROM public.dms_documents d
          WHERE d.id = p_document_id
            AND d.created_by_backoffice_user_id = public.dms_current_backoffice_user_id()
        )
        OR EXISTS (
          SELECT 1 FROM public.dms_document_permissions p
          WHERE p.document_id = p_document_id
            AND p.backoffice_user_id = public.dms_current_backoffice_user_id()
            AND p.permission IN ('WRITE', 'ADMIN')
        );
    $sf$;
  END IF;

  CREATE OR REPLACE FUNCTION public.dms_can_admin_document(p_document_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $sf$
    SELECT
      public.dms_is_backoffice_admin()
      OR EXISTS (
        SELECT 1 FROM public.dms_documents d
        WHERE d.id = p_document_id
          AND d.created_by_backoffice_user_id = public.dms_current_backoffice_user_id()
      )
      OR EXISTS (
        SELECT 1 FROM public.dms_document_permissions p
        WHERE p.document_id = p_document_id
          AND p.backoffice_user_id = public.dms_current_backoffice_user_id()
          AND p.permission = 'ADMIN'
      );
  $sf$;

  CREATE POLICY "dms_documents_select"
    ON public.dms_documents FOR SELECT TO authenticated
    USING (public.dms_can_read_document(id));

  CREATE POLICY "dms_documents_insert"
    ON public.dms_documents FOR INSERT TO authenticated
    WITH CHECK (created_by_backoffice_user_id = public.dms_current_backoffice_user_id());

  CREATE POLICY "dms_documents_update"
    ON public.dms_documents FOR UPDATE TO authenticated
    USING (public.dms_can_write_document(id))
    WITH CHECK (public.dms_can_write_document(id));

  CREATE POLICY "dms_documents_delete"
    ON public.dms_documents FOR DELETE TO authenticated
    USING (public.dms_can_admin_document(id));

  CREATE POLICY "dms_versions_select"
    ON public.dms_document_versions FOR SELECT TO authenticated
    USING (public.dms_can_read_document(document_id));

  CREATE POLICY "dms_versions_insert"
    ON public.dms_document_versions FOR INSERT TO authenticated
    WITH CHECK (public.dms_can_write_document(document_id));

  CREATE POLICY "dms_versions_delete"
    ON public.dms_document_versions FOR DELETE TO authenticated
    USING (public.dms_can_admin_document(document_id));

  CREATE POLICY "dms_perm_select"
    ON public.dms_document_permissions FOR SELECT TO authenticated
    USING (public.dms_can_read_document(document_id));

  CREATE POLICY "dms_perm_insert"
    ON public.dms_document_permissions FOR INSERT TO authenticated
    WITH CHECK (public.dms_can_admin_document(document_id));

  CREATE POLICY "dms_perm_update"
    ON public.dms_document_permissions FOR UPDATE TO authenticated
    USING (public.dms_can_admin_document(document_id))
    WITH CHECK (public.dms_can_admin_document(document_id));

  CREATE POLICY "dms_perm_delete"
    ON public.dms_document_permissions FOR DELETE TO authenticated
    USING (public.dms_can_admin_document(document_id));

  CREATE POLICY "dms_logs_select"
    ON public.dms_document_logs FOR SELECT TO authenticated
    USING (
      (
        document_id IS NOT NULL
        AND public.dms_can_read_document(document_id)
      )
      OR (
        document_id IS NULL
        AND public.dms_is_backoffice_admin()
      )
    );

  CREATE POLICY "dms_logs_insert"
    ON public.dms_document_logs FOR INSERT TO authenticated
    WITH CHECK (
      public.dms_can_read_document(document_id)
      AND (
        backoffice_user_id IS NULL
        OR backoffice_user_id = public.dms_current_backoffice_user_id()
      )
    );
END;
$dms_rls$;

GRANT ALL ON public.dms_documents TO authenticated;
GRANT ALL ON public.dms_document_versions TO authenticated;
GRANT ALL ON public.dms_document_permissions TO authenticated;
GRANT ALL ON public.dms_document_logs TO authenticated;

NOTIFY pgrst, 'reload schema';
