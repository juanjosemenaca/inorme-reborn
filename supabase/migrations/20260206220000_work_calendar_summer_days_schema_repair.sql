-- Reparación idempotente: proyectos donde `work_calendar_summer_days` existe pero falta `date_start`
-- (p. ej. CREATE de 20260206200000 falló por tabla previa, o 20260206210000 no aplicó el bloque).

DO $$
BEGIN
  -- 1) Tabla no existe: crear esquema completo (mismo que 20260206200000)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'work_calendar_summer_days'
  ) THEN
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

    CREATE INDEX IF NOT EXISTS idx_work_calendar_summer_days_year_scope
      ON public.work_calendar_summer_days (calendar_year, scope);

    DROP TRIGGER IF EXISTS tr_work_calendar_summer_days_updated_at ON public.work_calendar_summer_days;
    CREATE TRIGGER tr_work_calendar_summer_days_updated_at
      BEFORE UPDATE ON public.work_calendar_summer_days
      FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

    COMMENT ON TABLE public.work_calendar_summer_days IS
      'Rangos de horario de verano (7 h intensivo): fechas inicio/fin inclusive por año y sede.';

    ALTER TABLE public.work_calendar_summer_days ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'work_calendar_summer_days'
        AND policyname = 'backoffice_authenticated_all_work_calendar_summer_days'
    ) THEN
      CREATE POLICY "backoffice_authenticated_all_work_calendar_summer_days"
        ON public.work_calendar_summer_days FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    GRANT ALL ON public.work_calendar_summer_days TO authenticated;

  -- 2) Tabla existe: asegurar columnas de rango
  ELSE
    -- 2a) Esquema antiguo: columna day_date → date_start / date_end
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'work_calendar_summer_days' AND column_name = 'day_date'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'work_calendar_summer_days' AND column_name = 'date_start'
    ) THEN
      ALTER TABLE public.work_calendar_summer_days DROP CONSTRAINT IF EXISTS work_calendar_summer_days_unique_day;
      ALTER TABLE public.work_calendar_summer_days ADD COLUMN IF NOT EXISTS date_start date;
      ALTER TABLE public.work_calendar_summer_days ADD COLUMN IF NOT EXISTS date_end date;
      UPDATE public.work_calendar_summer_days
      SET date_start = day_date, date_end = day_date
      WHERE date_start IS NULL AND day_date IS NOT NULL;
      UPDATE public.work_calendar_summer_days
      SET date_start = make_date(calendar_year, 7, 1), date_end = make_date(calendar_year, 8, 31)
      WHERE date_start IS NULL;
      DELETE FROM public.work_calendar_summer_days WHERE date_start IS NULL;
      ALTER TABLE public.work_calendar_summer_days DROP COLUMN IF EXISTS day_date;
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

    -- 2b) Sin day_date pero sin date_start: añadir columnas y rellenar desde calendar_year (jul–ago de ese año)
    ELSIF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'work_calendar_summer_days' AND column_name = 'date_start'
    ) THEN
      ALTER TABLE public.work_calendar_summer_days ADD COLUMN date_start date;
      ALTER TABLE public.work_calendar_summer_days ADD COLUMN date_end date;
      UPDATE public.work_calendar_summer_days
      SET
        date_start = make_date(calendar_year, 7, 1),
        date_end = make_date(calendar_year, 8, 31)
      WHERE date_start IS NULL;
      DELETE FROM public.work_calendar_summer_days WHERE date_start IS NULL;
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

    -- 2c) date_start existe pero falta date_end (caso raro)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'work_calendar_summer_days' AND column_name = 'date_start'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'work_calendar_summer_days' AND column_name = 'date_end'
    ) THEN
      ALTER TABLE public.work_calendar_summer_days ADD COLUMN date_end date;
      UPDATE public.work_calendar_summer_days SET date_end = date_start WHERE date_end IS NULL;
      ALTER TABLE public.work_calendar_summer_days ALTER COLUMN date_end SET NOT NULL;
    END IF;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
