-- Política de contraseñas: cambio obligatorio al alta / forzado por admin, y seguimiento del último cambio (renovación anual en cliente).

ALTER TABLE public.backoffice_users
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz NULL;

COMMENT ON COLUMN public.backoffice_users.must_change_password IS
  'Si true, el usuario debe cambiar la contraseña antes de usar el resto del backoffice.';
COMMENT ON COLUMN public.backoffice_users.password_changed_at IS
  'Marca de último cambio de contraseña en Auth (tras cambio en la app).';

-- Usuarios ya existentes: no les exigimos cambio inmediato; la renovación anual se calcula desde esta fecha.
UPDATE public.backoffice_users
SET password_changed_at = COALESCE(created_at, now())
WHERE password_changed_at IS NULL;
