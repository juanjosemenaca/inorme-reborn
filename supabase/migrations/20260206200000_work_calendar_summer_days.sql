-- Horario de verano: rangos de fechas (inicio y fin inclusive); en la app solo lun–vie se pintan en verde.

CREATE TABLE public.work_calendar_summer_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_year int NOT NULL CHECK (calendar_year >= 2000 AND calendar_year <= 2100),
  scope public.work_calendar_scope NOT NULL,
  date_start date NOT NULL,
  date_end date NOT NULL,
  label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_calendar_summer_days_end_after_start CHECK (date_end >= date_start),
  CONSTRAINT work_calendar_summer_days_unique_range UNIQUE (calendar_year, scope, date_start, date_end)
);

CREATE INDEX idx_work_calendar_summer_days_year_scope ON public.work_calendar_summer_days (calendar_year, scope);

CREATE TRIGGER tr_work_calendar_summer_days_updated_at
  BEFORE UPDATE ON public.work_calendar_summer_days
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

COMMENT ON TABLE public.work_calendar_summer_days IS
  'Rangos de horario de verano (7 h intensivo): fechas inicio/fin inclusive por año y sede.';

ALTER TABLE public.work_calendar_summer_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backoffice_authenticated_all_work_calendar_summer_days"
  ON public.work_calendar_summer_days FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.work_calendar_summer_days TO authenticated;

NOTIFY pgrst, 'reload schema';
