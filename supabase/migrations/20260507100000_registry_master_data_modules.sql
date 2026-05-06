-- Módulos activables: maestros (trabajadores, clientes, proyectos, proveedores) para usuarios WORKER.

DO $mods$
BEGIN
  IF to_regclass('public.backoffice_users') IS NULL THEN
    RAISE NOTICE 'registry_modules: omitido (no existe public.backoffice_users)';
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
        'DMS',
        'ADMIN_COMPANY_WORKERS',
        'ADMIN_CLIENTS',
        'ADMIN_PROJECTS',
        'ADMIN_PROVIDERS'
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
        'DMS',
        'ADMIN_COMPANY_WORKERS',
        'ADMIN_CLIENTS',
        'ADMIN_PROJECTS',
        'ADMIN_PROVIDERS'
      ]::text[]
    );
END;
$mods$;
