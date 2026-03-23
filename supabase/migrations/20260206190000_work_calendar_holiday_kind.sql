-- Tipo de festivo: nacional, autonómico o local.

CREATE TYPE public.work_calendar_holiday_kind AS ENUM (
  'NACIONAL',
  'AUTONOMICO',
  'LOCAL'
);

ALTER TABLE public.work_calendar_holidays
  ADD COLUMN holiday_kind public.work_calendar_holiday_kind NOT NULL DEFAULT 'NACIONAL';

COMMENT ON COLUMN public.work_calendar_holidays.holiday_kind IS
  'Ámbito del festivo: nacional, autonómico (comunidad) o local (municipio/sede).';

NOTIFY pgrst, 'reload schema';
