# Contribuir y desplegar (GitHub + Supabase)

## Flujo habitual

1. Crea una rama, haz cambios y **commit**.
2. Abre un **pull request** a `main` (el workflow **CI** ejecuta lint + build).
3. Tras **merge a `main`**:
   - El código queda en **GitHub**.
   - Si tocaste `supabase/migrations/` o `supabase/config.toml`, el workflow **Deploy Supabase migrations** ejecuta `supabase db push` contra tu proyecto remoto.

## Secretos de GitHub (obligatorios para Supabase CI)

En el repositorio: **Settings → Secrets and variables → Actions → New repository secret**.

| Secreto | Descripción |
|--------|-------------|
| `SUPABASE_ACCESS_TOKEN` | [Account → Access Tokens](https://supabase.com/dashboard/account/tokens) en Supabase (crear token con permisos para el proyecto). |
| `SUPABASE_DB_PASSWORD` | Contraseña de la base de datos del proyecto: **Project Settings → Database → Database password** (o la que definiste al crear el proyecto). |
| `SUPABASE_PROJECT_ID` | Referencia del proyecto (subdominio). Ejemplo: `grasrjavkbeboynacvzp` (de `https://xxxx.supabase.co`). |

Sin estos tres secretos, el job **Deploy Supabase migrations** fallará al enlazar o al hacer push.

## Uso local (CLI)

Tras `npm install`:

```bash
# Una vez por máquina (login interactivo o variable SUPABASE_ACCESS_TOKEN)
npx supabase login

# Enlazar este repo al proyecto remoto (misma ref que en GitHub)
npm run db:link
# Introduce la contraseña de la BD cuando la pida, o usa variables de entorno según la doc del CLI.

# Aplicar migraciones pendientes al remoto
npm run db:push
```

Crear una nueva migración vacía:

```bash
npm run db:migration:new nombre_descriptivo
```

## Si ya aplicaste el SQL inicial a mano en el Dashboard

El historial de migraciones del CLI debe coincidir con la base. Si el esquema ya existe pero Supabase no tiene registrada la migración, revisa [migration repair](https://supabase.com/docs/reference/cli/supabase-migration-repair) o contacta con el equipo para alinear `supabase migration list` local y remoto.

## Archivos relevantes

- `.github/workflows/ci.yml` — lint + build en PR/push a `main`.
- `.github/workflows/deploy-supabase.yml` — `supabase db push` en push a `main` cuando cambian migraciones.
- `supabase/migrations/` — única fuente de verdad del esquema; **no** editar la BD en producción solo desde el SQL Editor sin reflejarlo aquí.
