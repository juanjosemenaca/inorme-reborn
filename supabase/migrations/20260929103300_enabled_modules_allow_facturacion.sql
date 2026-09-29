-- El CHECK de enabled_modules en producción se quedó en el set antiguo
-- (sin FACTURACION, DMS ni maestros) y bloqueaba asignar facturación.

DO $mods$
BEGIN
  IF to_regclass('public.backoffice_users') IS NULL THEN
    RAISE NOTICE 'enabled_modules_allow_facturacion: omitido (no existe public.backoffice_users)';
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
        'FACTURACION',
        'DMS',
        'ADMIN_COMPANY_WORKERS',
        'ADMIN_CLIENTS',
        'ADMIN_PROJECTS',
        'ADMIN_PROVIDERS'
      )
    ),
    ARRAY[]::text[]
  );

  ALTER TABLE public.backoffice_users
    ADD CONSTRAINT backoffice_users_enabled_modules_valid
    CHECK (
      enabled_modules <@ ARRAY[
        'VACATIONS',
        'MESSAGES',
        'TIME_CLOCK',
        'AGENDA',
        'GASTOS',
        'FACTURACION',
        'DMS',
        'ADMIN_COMPANY_WORKERS',
        'ADMIN_CLIENTS',
        'ADMIN_PROJECTS',
        'ADMIN_PROVIDERS'
      ]::text[]
    );
END;
$mods$;

NOTIFY pgrst, 'reload schema';
