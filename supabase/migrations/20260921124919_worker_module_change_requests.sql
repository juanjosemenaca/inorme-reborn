-- Solicitudes de cambio de módulos de intranet por trabajador (revisión admin).

CREATE TABLE public.worker_module_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_worker_id uuid NOT NULL REFERENCES public.company_workers (id) ON DELETE CASCADE,
  backoffice_user_id uuid NOT NULL REFERENCES public.backoffice_users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  worker_message text NOT NULL DEFAULT '',
  previous_modules text[] NOT NULL DEFAULT '{}',
  suggested_modules text[] NOT NULL DEFAULT '{}',
  reviewed_by uuid REFERENCES public.backoffice_users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_module_change_requests_modules_changed
    CHECK (previous_modules IS DISTINCT FROM suggested_modules)
);

CREATE UNIQUE INDEX worker_module_change_requests_one_pending_per_worker
  ON public.worker_module_change_requests (company_worker_id)
  WHERE status = 'PENDING';

CREATE INDEX idx_worker_module_change_requests_status_created
  ON public.worker_module_change_requests (status, created_at DESC);

COMMENT ON TABLE public.worker_module_change_requests IS
  'Cambio de módulos de intranet propuesto por el trabajador; el admin aprueba o rechaza.';

CREATE TRIGGER tr_worker_module_change_requests_updated_at
  BEFORE UPDATE ON public.worker_module_change_requests
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.worker_module_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backoffice_authenticated_all_worker_module_change_requests"
  ON public.worker_module_change_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.worker_module_change_requests TO authenticated;

NOTIFY pgrst, 'reload schema';
