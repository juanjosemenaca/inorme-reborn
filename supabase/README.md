# Supabase (Inorme)

## CI/CD (GitHub)

Al hacer **merge a `main`**, si cambian archivos en `supabase/migrations/`, el workflow aplica migraciones en el proyecto remoto. Requisitos: secretos `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID` (ver `CONTRIBUTING.md` en la raíz del repo).

## No veo las tablas en Supabase

Las tablas **solo existen después** de aplicar la migración SQL una vez. No se crean solas al conectar la web.

### Opción A — SQL Editor (recomendado la primera vez)

1. Entra en [Supabase Dashboard](https://supabase.com/dashboard) → **el proyecto correcto** (`grasrjavkbeboynacvzp`).
2. Menú izquierdo → **SQL** → **New query**.
3. Abre en tu repo el archivo `migrations/20260206120000_initial_schema.sql`, **copia todo el contenido**, pégalo en el editor y pulsa **Run** (o `Ctrl/Cmd + Enter`).
4. Debe salir **Success** sin errores.
5. Menú **Table Editor** → esquema **public** (arriba). Deberías ver:
   - `providers`, `company_workers`, `clients`, `client_contact_persons`, `provider_contact_persons`, `backoffice_users`.

Para comprobar sin abrir Table Editor, ejecuta también `VERIFY_TABLES.sql` (misma pantalla SQL).

### Opción B — CLI (`db push`)

Con el repo enlazado y secretos/config correctos: `npm run db:link` y luego `npm run db:push` (ver `CONTRIBUTING.md`). Si el workflow de GitHub falla, revisa **Actions** y los secretos `SUPABASE_*`.

### Si al ejecutar el SQL dice que ya existe

Significa que parte del script ya se aplicó. No pegues el archivo entero otra vez; revisa el mensaje de error o ejecuta `VERIFY_TABLES.sql` para ver qué tablas faltan.

## Migración inicial

Archivo: `migrations/20260206120000_initial_schema.sql` (mismo contenido que debes ejecutar en el paso A).

Si usas [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref TU_PROJECT_REF
supabase db push
```

## Mapeo TypeScript

- Tipos de fila: `src/types/database.ts` (snake_case).
- Dominio ↔ Postgres: `src/lib/supabase/mappers.ts` (`clientRowToDomain`, `providerRecordToRowInsert`, etc.).
- Reexport: `import { ... } from "@/lib/supabase"`.

## Tablas

| Tabla | Equivale a (TypeScript) |
|-------|-------------------------|
| `providers` | `ProviderRecord` |
| `company_workers` | `CompanyWorkerRecord` |
| `clients` + `client_contact_persons` | `ClientRecord` + `contacts[]` |
| `providers` + `provider_contact_persons` | contactos embebidos en proveedor |
| `backoffice_users` | `BackofficeUserRecord` (sin `password`; usar Auth) |

## Notas

- **RLS:** las políticas actuales permiten CRUD a cualquier usuario **autenticado** (`authenticated`). Ajusta antes de producción (p. ej. por rol `ADMIN`).
- **Sin sesión:** con la anon key y sin login JWT, PostgREST no aplicará políticas de `authenticated`; necesitas **Supabase Auth** en la app o políticas adicionales (solo entorno dev).
