-- Reparación idempotente: si la tabla existe pero falta holiday_kind (error PostgREST:
-- "Could not find the 'holiday_kind' column of 'work_calendar_holidays' in the schema cache"),
-- crea el tipo ENUM y la columna sin duplicar.

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'work_calendar_holiday_kind'
  ) THEN
    CREATE TYPE public.work_calendar_holiday_kind AS ENUM (
      'NACIONAL',
      'AUTONOMICO',
      'LOCAL'
    );
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'work_calendar_holidays'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_calendar_holidays'
      AND column_name = 'holiday_kind'
  ) THEN
    ALTER TABLE public.work_calendar_holidays
      ADD COLUMN holiday_kind public.work_calendar_holiday_kind NOT NULL DEFAULT 'NACIONAL';

    COMMENT ON COLUMN public.work_calendar_holidays.holiday_kind IS
      'Ámbito del festivo: nacional, autonómico (comunidad) o local (municipio/sede).';
  END IF;
END
$migration$;

NOTIFY pgrst, 'reload schema';
