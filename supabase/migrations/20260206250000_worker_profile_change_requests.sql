-- Solicitudes de modificación de ficha por trabajador (revisión admin).

CREATE TABLE public.worker_profile_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_worker_id uuid NOT NULL REFERENCES public.company_workers (id) ON DELETE CASCADE,
  backoffice_user_id uuid NOT NULL REFERENCES public.backoffice_users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  worker_message text NOT NULL DEFAULT '',
  -- Valores sugeridos (JSON con firstName, lastName, dni, email, mobile, postalAddress, city).
  suggested jsonb NOT NULL,
  -- Copia al crear la solicitud (para comparar en admin).
  previous_snapshot jsonb,
  reviewed_by uuid REFERENCES public.backoffice_users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX worker_profile_change_requests_one_pending_per_worker
  ON public.worker_profile_change_requests (company_worker_id)
  WHERE status = 'PENDING';

CREATE INDEX idx_worker_profile_change_requests_status_created
  ON public.worker_profile_change_requests (status, created_at DESC);

COMMENT ON TABLE public.worker_profile_change_requests IS
  'Cambios de datos personales propuestos por trabajadores; el admin aprueba o rechaza.';

CREATE TRIGGER tr_worker_profile_change_requests_updated_at
  BEFORE UPDATE ON public.worker_profile_change_requests
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.worker_profile_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backoffice_authenticated_all_worker_profile_change_requests"
  ON public.worker_profile_change_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
