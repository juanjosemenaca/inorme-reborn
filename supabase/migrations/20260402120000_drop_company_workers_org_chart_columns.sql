-- Elimina restos del organigrama en company_workers (tras revertir la feature en código).

DROP INDEX IF EXISTS public.idx_company_workers_manager;

ALTER TABLE public.company_workers
  DROP CONSTRAINT IF EXISTS company_workers_manager_not_self;

ALTER TABLE public.company_workers
  DROP COLUMN IF EXISTS manager_id,
  DROP COLUMN IF EXISTS org_roles,
  DROP COLUMN IF EXISTS team_labels;
