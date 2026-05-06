-- Agenda: entradas ligadas a un proyecto (visibles para responsable y miembros).

ALTER TABLE public.worker_agenda_items
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects (id) ON DELETE CASCADE;

ALTER TABLE public.worker_agenda_items
  DROP CONSTRAINT IF EXISTS worker_agenda_items_scope_ck;

ALTER TABLE public.worker_agenda_items
  ADD CONSTRAINT worker_agenda_items_scope_ck CHECK (
    (
      applies_to_all_company_workers = true
      AND company_worker_id IS NULL
      AND project_id IS NULL
    )
    OR (
      project_id IS NOT NULL
      AND company_worker_id IS NULL
      AND applies_to_all_company_workers = false
    )
    OR (
      applies_to_all_company_workers = false
      AND company_worker_id IS NOT NULL
      AND project_id IS NULL
    )
  );

CREATE INDEX IF NOT EXISTS idx_worker_agenda_items_project_starts
  ON public.worker_agenda_items (project_id, starts_at)
  WHERE project_id IS NOT NULL;

COMMENT ON COLUMN public.worker_agenda_items.project_id IS
  'Proyecto: la entrada aparece en la agenda del responsable y de los miembros (project_members).';

NOTIFY pgrst, 'reload schema';
