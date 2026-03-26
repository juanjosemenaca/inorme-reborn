-- Días de vacaciones elegidos por el trabajador (por año natural), sin superar el máximo de su ficha.

CREATE TABLE public.company_worker_vacation_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_worker_id uuid NOT NULL REFERENCES public.company_workers (id) ON DELETE CASCADE,
  vacation_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_worker_vacation_days_unique_day UNIQUE (company_worker_id, vacation_date)
);

CREATE INDEX idx_company_worker_vacation_days_worker_year
  ON public.company_worker_vacation_days (company_worker_id, (EXTRACT(YEAR FROM vacation_date)));

CREATE TRIGGER tr_company_worker_vacation_days_updated_at
  BEFORE UPDATE ON public.company_worker_vacation_days
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

COMMENT ON TABLE public.company_worker_vacation_days IS
  'Días naturales de vacaciones reservados por el trabajador en el año (vista según su calendario laboral).';

ALTER TABLE public.company_worker_vacation_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backoffice_authenticated_all_company_worker_vacation_days"
  ON public.company_worker_vacation_days FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.company_worker_vacation_days TO authenticated;

NOTIFY pgrst, 'reload schema';
