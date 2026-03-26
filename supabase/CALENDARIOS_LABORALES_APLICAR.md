# Calendarios laborales en Supabase

Si en **Admin → Calendarios laborales** ves error al cargar o la tabla vacía, aplica las migraciones en tu proyecto remoto.

## Opción A: CLI (recomendado)

En la raíz del repo, con [Supabase CLI](https://supabase.com/docs/guides/cli) instalada:

```bash
npx supabase login
npm run db:link
npm run db:push
```

(`db:link` en `package.json` usa un proyecto concreto; si no es el tuyo, cambia el `--project-ref` o ejecuta `npx supabase link --project-ref TU_REF`.)

Eso aplica **todas** las migraciones pendientes, incluidas:

- `20260206170000_work_calendar_holidays.sql` (tabla + RLS)
- `20260206180000_seed_work_calendar_2026.sql` (datos 2026)
- `20260206190000_work_calendar_holiday_kind.sql` (columna `holiday_kind`: nacional / autonómico / local)
- `20260206200000_work_calendar_summer_days.sql` (rangos de horario de verano 7 h: `date_start`–`date_end`)
- `20260206210000_work_calendar_summer_migrate_day_to_range.sql` (solo si tu BD tenía la versión antigua con un día por fila `day_date`)
- `20260206220000_work_calendar_summer_days_schema_repair.sql` (**reparación** si ves el error `column work_calendar_summer_days.date_start does not exist`: alinea el esquema con rangos `date_start` / `date_end`)
- `20260206230000_company_workers_work_calendar_scope.sql` (columna `work_calendar_scope` en `company_workers`: sede / calendario asignado a cada trabajador)
- `20260326120000_work_calendar_holiday_kind_repair.sql` (**reparación** si ves el error `Could not find the 'holiday_kind' column`: añade la columna de forma idempotente)
- `20260327100000_work_calendar_sites_and_vacation_days.sql` (**sedes dinámicas** + `vacation_days` en trabajadores; sustituye el enum `work_calendar_scope` por `work_calendar_sites` y `site_id` en festivos / verano)

### Error: `Could not find the 'holiday_kind' column` (schema cache)

La tabla `work_calendar_holidays` existe pero **falta la columna `holiday_kind`** (la migración `20260206190000_work_calendar_holiday_kind.sql` no llegó a aplicarse en tu proyecto remoto).

**Solución rápida (SQL Editor en Supabase):**

1. **SQL** → **New query**.
2. Pega y ejecuta el contenido de **`supabase/migrations/20260326120000_work_calendar_holiday_kind_repair.sql`** (es idempotente: no rompe si la columna ya existe).
3. Espera unos segundos o ejecuta `NOTIFY pgrst, 'reload schema';` y recarga la app.

Con CLI: `npx supabase db push` aplicará también esa migración de reparación.

### Error: `date_start does not exist`

Suele pasar si la tabla `work_calendar_summer_days` se creó con el esquema antiguo (`day_date`) y la migración de rangos no llegó a aplicarse. **Solución:** ejecuta `npm run db:push` (o `npx supabase db push`) para aplicar las migraciones pendientes, en particular **`20260206220000_work_calendar_summer_days_schema_repair.sql`**. Si no usas la CLI, abre el **SQL Editor** en Supabase, pega el contenido de ese archivo y ejecútalo; luego `NOTIFY pgrst, 'reload schema';` o espera unos segundos a que PostgREST recargue el esquema.

## Opción B: SQL Editor (Dashboard)

1. Abre **Supabase Dashboard** → tu proyecto → **SQL Editor** → **New query**.
2. Pega y ejecuta **en este orden** el contenido de:
   - `supabase/migrations/20260206170000_work_calendar_holidays.sql`
   - `supabase/migrations/20260206180000_seed_work_calendar_2026.sql`
   - `supabase/migrations/20260206190000_work_calendar_holiday_kind.sql`
   - `supabase/migrations/20260206200000_work_calendar_summer_days.sql`
   - (opcional) `supabase/migrations/20260206210000_work_calendar_summer_migrate_day_to_range.sql` si migraste desde una tabla con `day_date`
   - (si falla la carga del admin con `date_start does not exist`) `supabase/migrations/20260206220000_work_calendar_summer_days_schema_repair.sql`
3. Si aparece *Could not find the table … in the schema cache*, ejecuta también:

   ```sql
   NOTIFY pgrst, 'reload schema';
   ```

## Comprobar

- **Table Editor**: tabla `work_calendar_holidays` con filas para `calendar_year = 2026`.
- En la app: año **2026** en el selector (por defecto es el año actual).

## Recordatorios

- Solo usuarios con rol **ADMIN** ven el menú y la ruta `/admin/calendarios-laborales`.
- Tras cambiar `.env` (URL/anon key), reinicia `npm run dev`.
