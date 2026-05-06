-- Reparación manual: columna project_id y reglas de alcance en worker_agenda_items.
-- Ejecutar en Supabase → SQL Editor si ves:
--   "Could not find the 'project_id' column of 'worker_agenda_items' in the schema cache"
--
-- Idempotente. Al final fuerza recarga del esquema de PostgREST.

-- 1) Alcance "todos los trabajadores" (por si falta la migración 20260509100000)
ALTER TABLE public.worker_agenda_items
  ADD COLUMN IF NOT EXISTS applies_to_all_company_workers boolean NOT NULL DEFAULT false;

ALTER TABLE public.worker_agenda_items
  ALTER COLUMN company_worker_id DROP NOT NULL;

-- 2) Alcance por proyecto
ALTER TABLE public.worker_agenda_items
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects (id) ON DELETE CASCADE;

-- 3) Regla: personal | todos | proyecto (excluyentes)
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

CREATE INDEX IF NOT EXISTS idx_worker_agenda_items_company_wide_starts
  ON public.worker_agenda_items (starts_at)
  WHERE applies_to_all_company_workers = true;

CREATE INDEX IF NOT EXISTS idx_worker_agenda_items_project_starts
  ON public.worker_agenda_items (project_id, starts_at)
  WHERE project_id IS NOT NULL;

COMMENT ON COLUMN public.worker_agenda_items.applies_to_all_company_workers IS
  'Si es true, la entrada aparece en el calendario/agenda de todos los trabajadores (company_worker_id NULL).';

COMMENT ON COLUMN public.worker_agenda_items.project_id IS
  'Proyecto: la entrada aparece en la agenda del responsable y de los miembros (project_members).';

NOTIFY pgrst, 'reload schema';
