-- Solicitudes de cambios en vacaciones del trabajador (requieren aprobación de admin).

CREATE TABLE public.worker_vacation_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_worker_id uuid NOT NULL REFERENCES public.company_workers (id) ON DELETE CASCADE,
  backoffice_user_id uuid NOT NULL REFERENCES public.backoffice_users (id) ON DELETE CASCADE,
  calendar_year integer NOT NULL CHECK (calendar_year >= 2000 AND calendar_year <= 2100),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  worker_message text NOT NULL DEFAULT '',
  proposed_dates jsonb NOT NULL DEFAULT '[]'::jsonb,
  previous_approved_dates jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewed_by uuid REFERENCES public.backoffice_users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX worker_vacation_change_requests_one_pending_per_worker_year
  ON public.worker_vacation_change_requests (company_worker_id, calendar_year)
  WHERE status = 'PENDING';

CREATE INDEX idx_worker_vacation_change_requests_status_created
  ON public.worker_vacation_change_requests (status, created_at DESC);

CREATE INDEX idx_worker_vacation_change_requests_worker
  ON public.worker_vacation_change_requests (company_worker_id, created_at DESC);

CREATE TRIGGER tr_worker_vacation_change_requests_updated_at
  BEFORE UPDATE ON public.worker_vacation_change_requests
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

COMMENT ON TABLE public.worker_vacation_change_requests IS
  'Cambios propuestos por el trabajador sobre sus vacaciones aprobadas; requieren validación de administración.';

ALTER TABLE public.worker_vacation_change_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backoffice_authenticated_all_worker_vacation_change_requests"
  ON public.worker_vacation_change_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.worker_vacation_change_requests TO authenticated;

NOTIFY pgrst, 'reload schema';
