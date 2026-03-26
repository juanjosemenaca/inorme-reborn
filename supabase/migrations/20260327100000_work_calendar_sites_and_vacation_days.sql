-- Sedes laborales dinámicas (sustituyen el enum work_calendar_scope), días de vacaciones por sede y por trabajador.

-- 1) Tabla de sedes
CREATE TABLE public.work_calendar_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  vacation_days_default integer NOT NULL DEFAULT 22 CHECK (vacation_days_default >= 0 AND vacation_days_default <= 365),
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER tr_work_calendar_sites_updated_at
  BEFORE UPDATE ON public.work_calendar_sites
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

COMMENT ON TABLE public.work_calendar_sites IS
  'Sede / calendario laboral: festivos y horario de verano por sede; días de vacaciones por defecto para asignar a trabajadores.';

INSERT INTO public.work_calendar_sites (slug, name, vacation_days_default, is_system) VALUES
  ('BARCELONA', 'Barcelona', 22, true),
  ('MADRID', 'Madrid', 22, true),
  ('ARRASATE_MONDRAGON', 'Arrasate / Mondragón', 22, true);

ALTER TABLE public.work_calendar_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backoffice_authenticated_all_work_calendar_sites"
  ON public.work_calendar_sites FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.work_calendar_sites TO authenticated;

-- 2) Festivos: site_id en lugar de scope
ALTER TABLE public.work_calendar_holidays
  ADD COLUMN site_id uuid REFERENCES public.work_calendar_sites (id) ON DELETE CASCADE;

UPDATE public.work_calendar_holidays h
SET site_id = s.id
FROM public.work_calendar_sites s
WHERE s.slug = h.scope::text;

ALTER TABLE public.work_calendar_holidays ALTER COLUMN site_id SET NOT NULL;

ALTER TABLE public.work_calendar_holidays DROP CONSTRAINT work_calendar_holidays_unique_day;
ALTER TABLE public.work_calendar_holidays DROP COLUMN scope;

ALTER TABLE public.work_calendar_holidays
  ADD CONSTRAINT work_calendar_holidays_unique_day UNIQUE (calendar_year, site_id, holiday_date);

CREATE INDEX IF NOT EXISTS idx_work_calendar_holidays_site ON public.work_calendar_holidays (site_id);

-- 3) Horario de verano: site_id
DROP INDEX IF EXISTS idx_work_calendar_summer_days_year_scope;

ALTER TABLE public.work_calendar_summer_days DROP CONSTRAINT work_calendar_summer_days_unique_range;

ALTER TABLE public.work_calendar_summer_days
  ADD COLUMN site_id uuid REFERENCES public.work_calendar_sites (id) ON DELETE CASCADE;

UPDATE public.work_calendar_summer_days x
SET site_id = s.id
FROM public.work_calendar_sites s
WHERE s.slug = x.scope::text;

ALTER TABLE public.work_calendar_summer_days ALTER COLUMN site_id SET NOT NULL;

ALTER TABLE public.work_calendar_summer_days DROP COLUMN scope;

ALTER TABLE public.work_calendar_summer_days
  ADD CONSTRAINT work_calendar_summer_days_unique_range UNIQUE (calendar_year, site_id, date_start, date_end);

CREATE INDEX IF NOT EXISTS idx_work_calendar_summer_days_year_site
  ON public.work_calendar_summer_days (calendar_year, site_id);

-- 4) Trabajadores: sede por FK + días de vacaciones (editables solo por admin en la app)
ALTER TABLE public.company_workers
  ADD COLUMN work_calendar_site_id uuid REFERENCES public.work_calendar_sites (id) ON DELETE RESTRICT;

ALTER TABLE public.company_workers
  ADD COLUMN vacation_days integer;

UPDATE public.company_workers cw
SET work_calendar_site_id = s.id
FROM public.work_calendar_sites s
WHERE s.slug = cw.work_calendar_scope::text;

UPDATE public.company_workers cw
SET vacation_days = s.vacation_days_default
FROM public.work_calendar_sites s
WHERE s.id = cw.work_calendar_site_id;

ALTER TABLE public.company_workers ALTER COLUMN work_calendar_site_id SET NOT NULL;
ALTER TABLE public.company_workers ALTER COLUMN vacation_days SET NOT NULL;
ALTER TABLE public.company_workers ALTER COLUMN vacation_days SET DEFAULT 22;

DROP INDEX IF EXISTS idx_company_workers_work_calendar_scope;
ALTER TABLE public.company_workers DROP COLUMN work_calendar_scope;

CREATE INDEX IF NOT EXISTS idx_company_workers_work_calendar_site
  ON public.company_workers (work_calendar_site_id);

COMMENT ON COLUMN public.company_workers.work_calendar_site_id IS
  'Sede / calendario laboral asignado (festivos y horario de verano).';
COMMENT ON COLUMN public.company_workers.vacation_days IS
  'Días de vacaciones anuales asignados al trabajador (solo administración en la app).';

-- 5) Enum antiguo ya no se usa
DROP TYPE public.work_calendar_scope;

NOTIFY pgrst, 'reload schema';
