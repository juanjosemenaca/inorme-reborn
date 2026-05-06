-- Módulo backoffice DMS en enabled_modules + fases de tarea en revisiones DMS.

-- ---------------------------------------------------------------------------
-- Módulo DMS (gestor documental) como módulo activable
-- ---------------------------------------------------------------------------
DO $mods$
BEGIN
  IF to_regclass('public.backoffice_users') IS NULL THEN
    RAISE NOTICE 'dms_module: omitido (no existe public.backoffice_users)';
    RETURN;
  END IF;

  ALTER TABLE public.backoffice_users
    DROP CONSTRAINT IF EXISTS backoffice_users_enabled_modules_valid;

  UPDATE public.backoffice_users AS u
  SET enabled_modules = COALESCE(
    (
      SELECT array_agg(DISTINCT elem)
      FROM unnest(u.enabled_modules) AS elem
      WHERE elem IN (
        'VACATIONS',
        'MESSAGES',
        'TIME_CLOCK',
        'AGENDA',
        'GASTOS',
        'DMS'
      )
    ),
    ARRAY[]::text[]
  );

  UPDATE public.backoffice_users
  SET enabled_modules = ARRAY['VACATIONS', 'MESSAGES', 'TIME_CLOCK', 'AGENDA', 'GASTOS']::text[]
  WHERE cardinality(enabled_modules) = 0;

  ALTER TABLE public.backoffice_users
    ADD CONSTRAINT backoffice_users_enabled_modules_valid
    CHECK (
      enabled_modules <@ ARRAY[
        'VACATIONS',
        'MESSAGES',
        'TIME_CLOCK',
        'AGENDA',
        'GASTOS',
        'DMS'
      ]::text[]
    );
END;
$mods$;

-- ---------------------------------------------------------------------------
-- Fases de tarea (checks) en revisiones
-- ---------------------------------------------------------------------------
ALTER TABLE public.dms_document_reviews
  ADD COLUMN IF NOT EXISTS task_read_at timestamptz,
  ADD COLUMN IF NOT EXISTS task_review_at timestamptz,
  ADD COLUMN IF NOT EXISTS task_validate_at timestamptz,
  ADD COLUMN IF NOT EXISTS task_upload_at timestamptz;

NOTIFY pgrst, 'reload schema';
