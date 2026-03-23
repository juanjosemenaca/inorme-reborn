-- Proyectos (backoffice): vinculados a cliente; cliente final opcional si el cliente es intermediario.
-- Documentación: tabla project_documents + bucket Storage `project-documents` (crear en Dashboard).

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE RESTRICT,
  final_client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_final_diff_from_client CHECK (
    final_client_id IS NULL OR final_client_id <> client_id
  )
);

CREATE INDEX idx_projects_client ON public.projects (client_id);
CREATE INDEX idx_projects_final_client ON public.projects (final_client_id);
CREATE INDEX idx_projects_dates ON public.projects (start_date, end_date);

CREATE TRIGGER tr_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

COMMENT ON TABLE public.projects IS
  'Proyecto de negocio: cliente contratante; si es intermediario, cliente final opcional.';

CREATE TABLE public.project_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_project_documents_path ON public.project_documents (storage_path);
CREATE INDEX idx_project_documents_project ON public.project_documents (project_id);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backoffice_authenticated_all_projects"
  ON public.projects FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "backoffice_authenticated_all_project_documents"
  ON public.project_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.projects TO authenticated;
GRANT ALL ON public.project_documents TO authenticated;

-- PostgREST debe ver las tablas nuevas; sin esto a veces aparece:
-- "Could not find the table 'public.projects' in the schema cache"
NOTIFY pgrst, 'reload schema';
