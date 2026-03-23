-- Calendarios laborales: festivos por año y sede (Barcelona, Madrid, Arrasate/Mondragón).
-- Los días laborables habituales son L–V; aquí se registran los días NO laborables (festivos / puentes).

CREATE TYPE public.work_calendar_scope AS ENUM (
  'BARCELONA',
  'MADRID',
  'ARRASATE_MONDRAGON'
);

CREATE TABLE public.work_calendar_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_year int NOT NULL CHECK (calendar_year >= 2000 AND calendar_year <= 2100),
  scope public.work_calendar_scope NOT NULL,
  holiday_date date NOT NULL,
  label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_calendar_holidays_unique_day UNIQUE (calendar_year, scope, holiday_date)
);

CREATE INDEX idx_work_calendar_holidays_year_scope ON public.work_calendar_holidays (calendar_year, scope);
CREATE INDEX idx_work_calendar_holidays_date ON public.work_calendar_holidays (holiday_date);

CREATE TRIGGER tr_work_calendar_holidays_updated_at
  BEFORE UPDATE ON public.work_calendar_holidays
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

COMMENT ON TABLE public.work_calendar_holidays IS
  'Días no laborables del calendario corporativo por año y sede.';

ALTER TABLE public.work_calendar_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backoffice_authenticated_all_work_calendar_holidays"
  ON public.work_calendar_holidays FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.work_calendar_holidays TO authenticated;

NOTIFY pgrst, 'reload schema';
