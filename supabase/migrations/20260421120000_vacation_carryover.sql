-- Traspaso de días de vacaciones no disfrutados al año natural siguiente (solicitud + aprobación admin).
-- company_worker_vacation_days: marca días con carryover_from_year = año de origen del cupo.

-- 1) Columna en días ya reservados
ALTER TABLE public.company_worker_vacation_days
  ADD COLUMN IF NOT EXISTS carryover_from_year integer NULL;

ALTER TABLE public.company_worker_vacation_days
  DROP CONSTRAINT IF EXISTS company_worker_vacation_days_carryover_year_check;

ALTER TABLE public.company_worker_vacation_days
  ADD CONSTRAINT company_worker_vacation_days_carryover_year_check
  CHECK (
    carryover_from_year IS NULL
    OR (
      carryover_from_year >= 2000
      AND carryover_from_year = (EXTRACT(YEAR FROM vacation_date) - 1)
    )
  );

COMMENT ON COLUMN public.company_worker_vacation_days.carryover_from_year IS
  'Año natural de origen del cupo (año no disfrutado aprobado para usar en el año de vacation_date). NULL = día del cupo anual normal.';

-- 2) Solicitudes de traspaso
CREATE TABLE public.worker_vacation_carryover_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_worker_id uuid NOT NULL REFERENCES public.company_workers (id) ON DELETE CASCADE,
  backoffice_user_id uuid NOT NULL REFERENCES public.backoffice_users (id) ON DELETE CASCADE,
  source_year integer NOT NULL CHECK (source_year >= 2000 AND source_year <= 2100),
  target_year integer NOT NULL CHECK (target_year >= 2000 AND target_year <= 2100),
  days_requested integer NOT NULL CHECK (days_requested > 0),
  days_approved integer NULL CHECK (days_approved IS NULL OR days_approved >= 0),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  worker_message text NOT NULL DEFAULT '',
  reviewed_by uuid REFERENCES public.backoffice_users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_vacation_carryover_source_target_adjacent CHECK (target_year = source_year + 1)
);

CREATE UNIQUE INDEX worker_vacation_carryover_one_pending_per_worker_target
  ON public.worker_vacation_carryover_requests (company_worker_id, target_year)
  WHERE status = 'PENDING';

CREATE INDEX idx_worker_vacation_carryover_worker_created
  ON public.worker_vacation_carryover_requests (company_worker_id, created_at DESC);

CREATE INDEX idx_worker_vacation_carryover_status_created
  ON public.worker_vacation_carryover_requests (status, created_at DESC);

CREATE TRIGGER tr_worker_vacation_carryover_requests_updated_at
  BEFORE UPDATE ON public.worker_vacation_carryover_requests
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

COMMENT ON TABLE public.worker_vacation_carryover_requests IS
  'Peticiones para usar en target_year días no disfrutados de source_year (source_year+1=target_year), con validación de administración.';

ALTER TABLE public.worker_vacation_carryover_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backoffice_authenticated_all_worker_vacation_carryover_requests"
  ON public.worker_vacation_carryover_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.worker_vacation_carryover_requests TO authenticated;

-- Evitar días duplicados al añadir columna (debería ser vacío)
-- La restricción UNIQUE (company_worker_id, vacation_date) se mantiene.

NOTIFY pgrst, 'reload schema';
