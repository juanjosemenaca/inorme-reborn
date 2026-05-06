-- Distinción CV vs otros adjuntos en fichas (semáforo de completitud del trabajador).

ALTER TABLE public.entity_documents
  ADD COLUMN IF NOT EXISTS kind text;

UPDATE public.entity_documents
SET kind = 'OTHER'
WHERE kind IS NULL;

ALTER TABLE public.entity_documents
  ALTER COLUMN kind SET DEFAULT 'OTHER',
  ALTER COLUMN kind SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entity_documents_kind_check'
  ) THEN
    ALTER TABLE public.entity_documents
      ADD CONSTRAINT entity_documents_kind_check CHECK (kind IN ('CV', 'OTHER'));
  END IF;
END $$;

-- Ficheros existentes que parecen curriculum: marcarlos como CV (solo trabajadores).
UPDATE public.entity_documents ed
SET kind = 'CV'
WHERE ed.owner_type = 'COMPANY_WORKER'
  AND ed.kind = 'OTHER'
  AND (
    lower(ed.original_filename) ~ '(^|[^[:alnum:]_])(cv|curriculum|curri|vitae)([^[:alnum:]_]|$)'
    OR lower(ed.original_filename) LIKE '%curriculum%'
    OR lower(ed.original_filename) LIKE '%c.v.%'
  );

COMMENT ON COLUMN public.entity_documents.kind IS
  'CV = curriculum vitae; OTHER = adjunto general.';

NOTIFY pgrst, 'reload schema';
