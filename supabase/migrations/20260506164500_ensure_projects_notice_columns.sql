-- Asegura columnas de responsable y aviso de fin en `projects` (evita error PostgREST:
-- "Could not find the 'end_notice_at' column of 'projects' in the schema cache").
-- Idempotente: seguro si 20260414200000_project_responsible_end_notice.sql ya se aplicó.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS responsible_company_worker_id uuid REFERENCES public.company_workers (id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS end_notice_at date,
  ADD COLUMN IF NOT EXISTS end_notice_message_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_projects_responsible ON public.projects (responsible_company_worker_id);

COMMENT ON COLUMN public.projects.responsible_company_worker_id IS
  'Responsable del proyecto. Avisos de fin a responsable (si tiene usuario) y administradores.';

COMMENT ON COLUMN public.projects.end_notice_at IS
  'Día en que se envía el aviso. Si null, se usa (end_date - 2 meses).';

COMMENT ON COLUMN public.projects.end_notice_message_sent_at IS
  'Cuando ya se envió el aviso; se anula al cambiar fechas, responsable o aviso (desde app).';

NOTIFY pgrst, 'reload schema';
