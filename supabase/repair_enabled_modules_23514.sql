-- Si la migración legal_grupo falló con:
--   ERROR: check constraint "backoffice_users_enabled_modules_valid" ... is violated
-- ejecuta este script en el SQL Editor de Supabase (una vez) y vuelve a aplicar migraciones
-- o ejecuta solo el resto de 20260420180000_legal_grupo_module.sql a partir de CREATE TABLE legal_*.

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
      'LEGAL'
    )
  ),
  ARRAY[]::text[]
);

UPDATE public.backoffice_users
SET enabled_modules = ARRAY['VACATIONS', 'MESSAGES', 'TIME_CLOCK', 'AGENDA', 'GASTOS', 'LEGAL']::text[]
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
      'LEGAL'
    ]::text[]
  );

NOTIFY pgrst, 'reload schema';
