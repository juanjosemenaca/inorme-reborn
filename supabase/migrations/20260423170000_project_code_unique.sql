-- Codigo unico identificativo para cada proyecto (autogenerado).

CREATE SEQUENCE IF NOT EXISTS public.project_code_seq;

CREATE OR REPLACE FUNCTION public.generate_project_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  n bigint;
BEGIN
  n := nextval('public.project_code_seq');
  RETURN 'PRJ-' || lpad(n::text, 6, '0');
END;
$$;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_code text;

UPDATE public.projects
SET project_code = public.generate_project_code()
WHERE project_code IS NULL OR btrim(project_code) = '';

ALTER TABLE public.projects
  ALTER COLUMN project_code SET DEFAULT public.generate_project_code();

-- Asegura que la secuencia no choque con codigos ya asignados.
SELECT setval(
  'public.project_code_seq',
  GREATEST(
    COALESCE(
      (
        SELECT max(substring(project_code FROM '([0-9]+)$')::bigint)
        FROM public.projects
        WHERE project_code ~ '[0-9]+$'
      ),
      0
    ),
    COALESCE((SELECT last_value FROM public.project_code_seq), 0)
  )
);

ALTER TABLE public.projects
  ALTER COLUMN project_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_project_code_unique
  ON public.projects (project_code);

COMMENT ON COLUMN public.projects.project_code IS
  'Codigo unico identificativo de proyecto (PRJ-XXXXXX).';

NOTIFY pgrst, 'reload schema';
