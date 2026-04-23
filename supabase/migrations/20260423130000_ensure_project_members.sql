-- Reparación: el alta de proyectos falla con "Could not find the table 'public.project_members'"
-- si en el remoto no se aplicó 20260206160000_project_members.sql. Idempotente.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'project_member_role' AND n.nspname = 'public') THEN
    CREATE TYPE public.project_member_role AS ENUM (
      'CONSULTOR',
      'ANALISTA_FUNCIONAL',
      'ANALISTA_PROGRAMADOR',
      'PROGRAMADOR',
      'JEFE_DE_EQUIPO',
      'ADMINISTRATIVA',
      'CONTABLE',
      'CONTROLER'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  company_worker_id uuid NOT NULL REFERENCES public.company_workers (id) ON DELETE CASCADE,
  role public.project_member_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_members_unique_worker UNIQUE (project_id, company_worker_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members (project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_worker ON public.project_members (company_worker_id);

COMMENT ON TABLE public.project_members IS
  'Equipo asignado a un proyecto y rol funcional dentro del mismo.';

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "backoffice_authenticated_all_project_members" ON public.project_members;
CREATE POLICY "backoffice_authenticated_all_project_members"
  ON public.project_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.project_members TO authenticated;

NOTIFY pgrst, 'reload schema';
