# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Idiomas (i18n)

La web pública y el backoffice usan **castellano**, **catalán** e **inglés**. El idioma se guarda en `localStorage` (`inorme-lang`) y se refleja en `<html lang="…">`.

- Textos de la landing: `src/locales/es.json`, `ca.json`, `en.json` (claves planas).
- Textos del backoffice: `src/locales/admin.es.json`, `admin.ca.json`, `admin.en.json` (objeto `admin.*` con rutas tipo `admin.layout.nav_panel`).
- Selector **ES / CA / EN**: componente `src/components/LanguageSwitcher.tsx` (header y footer de la web; en el backoffice solo en la **barra superior**).

Los formularios modales del backoffice (altas/edición) pueden seguir mostrando cadenas en español hasta migrar sus etiquetas a `t(…)`.

## Backoffice (Inorme)

- **URL:** `/admin` (login en `/admin/login`)
- **Usuarios** (`public.backoffice_users` + **Supabase Auth**): el alta elige una **ficha de Trabajadores**; email, contraseña (Auth) y rol. Los datos personales se sincronizan desde la ficha. `auth_user_id` enlaza con `auth.users`.
- **Clientes** (`/admin/clientes`): tablas `clients` y `client_contact_persons` — datos fiscales, tipo final/intermediario, cliente final vinculado, contactos.
- **Proyectos** (`/admin/proyectos`): tablas `projects`, `project_documents` y `project_members` (trabajadores de `company_workers` con rol en el proyecto) — documentación en **Storage** (bucket `project-documents`).
- **Calendarios laborales** (`/admin/calendarios-laborales`): festivos por **año** y **sede** (Barcelona, Madrid, Arrasate/Mondragón), cada uno con **ámbito** nacional / autonómico / local (`holiday_kind`); **horario de verano** (rangos de fechas con jornada 7 h intensiva en días laborables, `work_calendar_summer_days`). Vista anual con colores; importación masiva desde texto/CSV.
  - **Excel de referencia** (rejilla anual, festivos en **rojo** `FF0000`): script `scripts/parse-work-calendar-xlsx.mjs` lee el `.xlsx` (hojas `MONDRAGÓN 2026`, `MADRID 2026`, `BARCELONA 2026`) y genera JSON/SQL. Ejemplo: `npm run parse-work-calendar -- --file "/ruta/CALENDARIOS LABORALES 2026.xlsx" --year 2026 --sql scripts/data/work_calendar_2026.sql`. Los datos generados para 2026 están en `scripts/data/work_calendar_2026.sql` (ejecutar en SQL Editor tras la migración `20260206170000_work_calendar_holidays.sql`).
- **Proveedores** (`/admin/proveedores`): `providers` y `provider_contact_persons`.
- **Trabajadores** (`/admin/trabajadores`): `company_workers` (vínculo opcional a `providers`).
- **Roles:** **ADMIN** / **WORKER** (RLS con JWT `authenticated`).
- **Sesión:** Supabase Auth (persistencia por defecto en `localStorage` del navegador).

### Base de datos / Supabase

Los datos del backoffice viven en **Postgres**; la app usa `src/api/*` (React Query + cliente en `src/lib/supabaseClient.ts`).

1. Copia `.env.example` a `.env` y pega la **anon key** (Dashboard → Project Settings → API).
2. **SQL inicial:** `20260206120000_initial_schema.sql`; proyectos: `20260206140000_projects.sql` y equipo en proyecto: `20260206160000_project_members.sql`; **calendarios laborales:** `20260206170000_work_calendar_holidays.sql` + `20260206180000_seed_work_calendar_2026.sql` + `20260206190000_work_calendar_holiday_kind.sql` + `20260206200000_work_calendar_summer_days.sql` (rangos horario verano 7 h) + si aplica `20260206210000_work_calendar_summer_migrate_day_to_range.sql` + `20260206220000_work_calendar_summer_days_schema_repair.sql` si PostgREST indica que falta `date_start` + `20260206230000_company_workers_work_calendar_scope.sql` (calendario laboral por trabajador). Aplicación paso a paso: [`supabase/CALENDARIOS_LABORALES_APLICAR.md`](./supabase/CALENDARIOS_LABORALES_APLICAR.md) (`supabase db push` o SQL Editor).
3. **Storage (documentación de proyectos):** en **Storage → New bucket** crea un bucket **privado** llamado `project-documents`. Añade políticas para que los usuarios **autenticados** puedan `SELECT`, `INSERT` y `DELETE` en `storage.objects` con `bucket_id = 'project-documents'` (o usa las plantillas del editor). Sin esto, la subida de archivos fallará.
4. **Si aparece «Could not find the table … in the schema cache»:** la migración de proyectos incluye `NOTIFY pgrst, 'reload schema'` al final. Si creaste las tablas antes sin esa línea, ejecuta en el SQL Editor `supabase/RELOAD_PGRST_SCHEMA.sql` y revisa **Project Settings → Data API** (esquema `public` expuesto).
5. **Primer administrador:** en **Authentication → Users** crea un usuario con email/contraseña; copia su UUID y en **SQL** inserta una fila en `backoffice_users` con ese `auth_user_id`, `role = 'ADMIN'` y datos de perfil (o crea primero la ficha en `company_workers` y vincula `company_worker_id`). Guía paso a paso: [`supabase/CREAR_ADMIN.md`](./supabase/CREAR_ADMIN.md).
6. **Mapeo:** `src/types/database.ts`, `src/lib/supabase/mappers.ts`.
7. Desactiva **“Confirm email”** en Auth (o confirma por correo) si usas **Usuarios → Nuevo usuario** desde el panel (usa `signUp` internamente).

**Si el login falla:**

| Mensaje en pantalla | Qué revisar |
|---------------------|-------------|
| Email o contraseña incorrectos | En **Authentication → Users** existe el usuario con **exactamente** ese email; la contraseña es la de Auth (no la de `backoffice_users`). Prueba **Send password recovery** o crea de nuevo el usuario. |
| Tu correo aún no está confirmado | **Providers → Email** → desactiva *Confirm email* o abre el enlace del correo de confirmación. |
| No hay perfil en la tabla «backoffice_users»… | Tras crear el usuario en Auth, falta la fila en `public.backoffice_users` (o `auth_user_id` distinto). Usa `supabase/BOOTSTRAP_FIRST_ADMIN.sql` o inserta la fila con el UUID de Auth. |
| Supabase no está configurado | Rellena `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env` y reinicia `npm run dev`. |

Asegúrate de que el `.env` apunte al **mismo proyecto** de Supabase donde creaste el usuario (URL y anon key del Dashboard → Settings → API).

Variables: `VITE_SUPABASE_URL` (por defecto el proyecto `grasrjavkbeboynacvzp`) y `VITE_SUPABASE_ANON_KEY`.

**GitHub + Supabase:** al subir cambios a `main`, GitHub Actions ejecuta CI (lint/build) y, si cambian migraciones, despliega el esquema con `supabase db push`. Configura los secretos del repositorio y el flujo de trabajo en [`CONTRIBUTING.md`](./CONTRIBUTING.md).
