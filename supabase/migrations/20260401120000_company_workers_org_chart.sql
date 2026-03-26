-- Organigrama: responsable jerárquico, roles y equipos (edges secundarios en UI).

ALTER TABLE public.company_workers
  ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.company_workers (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS org_roles text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS team_labels text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.company_workers
  DROP CONSTRAINT IF EXISTS company_workers_manager_not_self;

ALTER TABLE public.company_workers
  ADD CONSTRAINT company_workers_manager_not_self CHECK (
    manager_id IS NULL OR manager_id <> id
  );

CREATE INDEX IF NOT EXISTS idx_company_workers_manager ON public.company_workers (manager_id);

COMMENT ON COLUMN public.company_workers.manager_id IS 'Responsable directo en organigrama.';
COMMENT ON COLUMN public.company_workers.org_roles IS 'Roles mostrados en organigrama (ej. Director, Developer).';
COMMENT ON COLUMN public.company_workers.team_labels IS 'Equipos para relaciones secundarias (líneas punteadas).';
