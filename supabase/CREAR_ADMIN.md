# Crear un usuario administrador nuevo

La contraseña **solo** existe en **Supabase Auth** (no en SQL). Este archivo describe el flujo completo.

## 1. Crear el usuario en Authentication

1. Abre [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto.
2. **Authentication** → **Users** → **Add user** → **Create new user**.
3. Rellena, por ejemplo:
   - **Email:** `backoffice.admin@inorme.com` (elige el que quieras; debe coincidir con el SQL del paso 3).
   - **Password:** una contraseña segura que **solo tú** conozcas (el panel la guarda en `auth.users`).
4. Opcional: desactiva *“Auto Confirm User”* solo si quieres confirmar por correo; para pruebas suele ir bien dejar el usuario confirmado al crearlo desde el panel.
5. Crea el usuario y **copia su UUID** (columna **UID** en la lista de usuarios, o detalle del usuario).

## 2. Asegurar el esquema

Debe estar aplicada la migración `20260206120000_initial_schema.sql` (tabla `public.backoffice_users`).

## 3. Enlazar el perfil backoffice (SQL)

**SQL Editor** → pega y sustituye `EMAIL_AQUI` y `UUID_AQUI`:

```sql
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
  lower(trim('EMAIL_AQUI')),
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
  'UUID_AQUI'::uuid
)
ON CONFLICT (email) DO UPDATE SET
  auth_user_id = EXCLUDED.auth_user_id,
  role = 'ADMIN',
  active = true;
```

**Ejemplo** (no uses estos valores si no son los tuyos):

- `EMAIL_AQUI` → `backoffice.admin@inorme.com`
- `UUID_AQUI` → el UUID que copiaste del usuario en Authentication

## 4. Probar el login

En la web: `/admin/login` con el mismo email y la contraseña que pusiste al crear el usuario en el paso 1.

---

Si ya tenías una fila en `backoffice_users` con el mismo email pero `auth_user_id` vacío, el primer login con la app puede enlazarla automáticamente; si no, usa el `ON CONFLICT` de arriba para forzar `auth_user_id` y rol `ADMIN`.
