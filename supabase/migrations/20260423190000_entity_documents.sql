-- Documentos adjuntos para fichas de trabajadores, clientes y proveedores.
-- Reutiliza el bucket existente `project-documents` (rutas `entity-documents/...`).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'entity_document_owner_type'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.entity_document_owner_type AS ENUM (
      'COMPANY_WORKER',
      'CLIENT',
      'PROVIDER'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.entity_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type public.entity_document_owner_type NOT NULL,
  owner_id uuid NOT NULL,
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_documents_owner ON public.entity_documents (owner_type, owner_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_documents_storage_path ON public.entity_documents (storage_path);

COMMENT ON TABLE public.entity_documents IS
  'Adjuntos de fichas administrativas (trabajador, cliente, proveedor).';

ALTER TABLE public.entity_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "backoffice_authenticated_all_entity_documents" ON public.entity_documents;
CREATE POLICY "backoffice_authenticated_all_entity_documents"
  ON public.entity_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.entity_documents TO authenticated;

NOTIFY pgrst, 'reload schema';
