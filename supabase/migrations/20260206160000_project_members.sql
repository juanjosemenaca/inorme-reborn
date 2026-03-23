-- Asignación de trabajadores (company_workers) a proyectos con rol en el proyecto.
-- Un mismo trabajador puede estar en varios proyectos; en cada proyecto solo una fila por trabajador.

CREATE TYPE public.project_member_role AS ENUM (
  'CONSULTOR',
  'ANALISTA_FUNCIONAL',
  'ANALISTA_PROGRAMADOR',
  'PROGRAMADOR',
  'JEFE_DE_EQUIPO'
);

CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  company_worker_id uuid NOT NULL REFERENCES public.company_workers (id) ON DELETE CASCADE,
  role public.project_member_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_members_unique_worker UNIQUE (project_id, company_worker_id)
);

CREATE INDEX idx_project_members_project ON public.project_members (project_id);
CREATE INDEX idx_project_members_worker ON public.project_members (company_worker_id);

COMMENT ON TABLE public.project_members IS
  'Equipo asignado a un proyecto y rol funcional dentro del mismo.';

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backoffice_authenticated_all_project_members"
  ON public.project_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.project_members TO authenticated;

NOTIFY pgrst, 'reload schema';
