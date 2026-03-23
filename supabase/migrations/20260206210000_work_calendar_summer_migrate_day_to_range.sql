-- Si la tabla se creó con la migración antigua (un día por fila `day_date`), migrar a rangos.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_calendar_summer_days'
      AND column_name = 'day_date'
  ) THEN
    ALTER TABLE public.work_calendar_summer_days DROP CONSTRAINT IF EXISTS work_calendar_summer_days_unique_day;
    ALTER TABLE public.work_calendar_summer_days ADD COLUMN IF NOT EXISTS date_start date;
    ALTER TABLE public.work_calendar_summer_days ADD COLUMN IF NOT EXISTS date_end date;
    UPDATE public.work_calendar_summer_days SET date_start = day_date, date_end = day_date WHERE date_start IS NULL;
    ALTER TABLE public.work_calendar_summer_days DROP COLUMN day_date;
    ALTER TABLE public.work_calendar_summer_days ALTER COLUMN date_start SET NOT NULL;
    ALTER TABLE public.work_calendar_summer_days ALTER COLUMN date_end SET NOT NULL;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_calendar_summer_days_end_after_start') THEN
      ALTER TABLE public.work_calendar_summer_days ADD CONSTRAINT work_calendar_summer_days_end_after_start
        CHECK (date_end >= date_start);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_calendar_summer_days_unique_range') THEN
      ALTER TABLE public.work_calendar_summer_days ADD CONSTRAINT work_calendar_summer_days_unique_range
        UNIQUE (calendar_year, scope, date_start, date_end);
    END IF;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
