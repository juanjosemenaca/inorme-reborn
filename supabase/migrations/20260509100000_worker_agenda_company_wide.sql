-- Entradas de agenda visibles para todos los trabajadores (una fila, sin company_worker_id).

ALTER TABLE public.worker_agenda_items
  ADD COLUMN IF NOT EXISTS applies_to_all_company_workers boolean NOT NULL DEFAULT false;

ALTER TABLE public.worker_agenda_items
  ALTER COLUMN company_worker_id DROP NOT NULL;

ALTER TABLE public.worker_agenda_items
  DROP CONSTRAINT IF EXISTS worker_agenda_items_scope_ck;

ALTER TABLE public.worker_agenda_items
  ADD CONSTRAINT worker_agenda_items_scope_ck CHECK (
    (applies_to_all_company_workers = true AND company_worker_id IS NULL)
    OR (applies_to_all_company_workers = false AND company_worker_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_worker_agenda_items_company_wide_starts
  ON public.worker_agenda_items (starts_at)
  WHERE applies_to_all_company_workers = true;

COMMENT ON COLUMN public.worker_agenda_items.applies_to_all_company_workers IS
  'Si es true, la entrada aparece en el calendario/agenda de todos los trabajadores (company_worker_id NULL).';

NOTIFY pgrst, 'reload schema';
