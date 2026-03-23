-- Primer acceso al backoffice (después de 20260206120000_initial_schema.sql)
--
-- 1) Supabase → Authentication → Users → "Add user" (email + contraseña).
-- 2) Copia el UUID del usuario (columna UID / id).
-- 3) Sustituye abajo el email y el UUID, luego Run.

INSERT INTO public.backoffice_users (
  email,
  role,
  company_worker_id,
  first_name,
  last_name,
  dni,
  mobile,
  postal_address,
  city,
  employment_type,
  active,
  auth_user_id
) VALUES (
  'admin@tu-dominio.com',           -- mismo email que en Authentication
  'ADMIN',
  NULL,
  'Admin',
  'Inorme',
  '00000000A',
  '',
  '',
  'Madrid',
  'FIJO',
  true,
  '00000000-0000-0000-0000-000000000000'::uuid   -- pega aquí el UUID de Auth
)
ON CONFLICT (email) DO UPDATE SET
  auth_user_id = EXCLUDED.auth_user_id,
  role = 'ADMIN',
  active = true;
