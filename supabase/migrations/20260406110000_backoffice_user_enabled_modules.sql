-- Activación de módulos por usuario trabajador.

ALTER TABLE public.backoffice_users
  ADD COLUMN IF NOT EXISTS enabled_modules text[] NOT NULL DEFAULT ARRAY['VACATIONS', 'MESSAGES', 'TIME_CLOCK']::text[];

UPDATE public.backoffice_users
SET enabled_modules = ARRAY['VACATIONS', 'MESSAGES', 'TIME_CLOCK']::text[]
WHERE enabled_modules IS NULL;

ALTER TABLE public.backoffice_users
  DROP CONSTRAINT IF EXISTS backoffice_users_enabled_modules_valid;

ALTER TABLE public.backoffice_users
  ADD CONSTRAINT backoffice_users_enabled_modules_valid
  CHECK (enabled_modules <@ ARRAY['VACATIONS', 'MESSAGES', 'TIME_CLOCK']::text[]);

NOTIFY pgrst, 'reload schema';
