-- Resultado del trabajador sobre el documento: OK o subir nueva versión (NOT_OK).

ALTER TABLE public.dms_document_reviews
  ADD COLUMN IF NOT EXISTS worker_outcome text;

DO $wo$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dms_document_reviews_worker_outcome_check'
      AND conrelid = 'public.dms_document_reviews'::regclass
  ) THEN
    ALTER TABLE public.dms_document_reviews
      ADD CONSTRAINT dms_document_reviews_worker_outcome_check
      CHECK (worker_outcome IS NULL OR worker_outcome IN ('OK', 'NOT_OK'));
  END IF;
END;
$wo$;

NOTIFY pgrst, 'reload schema';
