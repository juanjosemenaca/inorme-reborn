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

## Backoffice (Inorme)

- **URL:** `/admin` (login en `/admin/login`)
- **Usuarios** (acceso al backoffice, `inorme_backoffice_user_db_v2`): el alta elige una **ficha de Trabajadores**; se asignan email de acceso (por defecto el de la ficha), contraseña y rol (admin o trabajador). Los datos personales vienen de Trabajadores y se sincronizan al guardar. Cuentas demo sin ficha siguen siendo válidas.
- **Clientes** (`/admin/clientes`, clave `inorme_clients_db_v1`): nombre comercial, razón social, CIF, dirección fiscal, tipo (cliente final / intermediario), teléfono y email de contacto, notas; si es **intermediario**, opcionalmente un **cliente final** vinculado (si se conoce); **personas de contacto** por cliente (nombre, apellidos, email, móvil, cargo, descripción).
- **Proveedores** (`/admin/proveedores`, `inorme_providers_db_v1`): mismos datos de alta que un cliente (fiscal, contacto, personas de contacto), para empresas externas (subcontratas, autónomos societarios, etc.).
- **Trabajadores** (`/admin/trabajadores`, `inorme_company_workers_db_v1`): plantilla de la compañía — nombre, apellidos, DNI, email, móvil, dirección postal, ciudad de residencia, tipo (fijo, temporal, subcontratado, prácticas, autónomo); **subcontratado** y **autónomo por empresa** se vinculan a un proveedor; **autónomo** puede ser por cuenta propia o por empresa (proveedor).
- **Roles:** **ADMIN** — gestión de usuarios y acceso global. **WORKER** — mensajes asignados y vistas permitidas.
- La sesión se guarda en `sessionStorage` hasta cerrar sesión.
- **Seguridad:** demo sin API (contraseñas en claro en `localStorage`); en producción usa backend con hash y base de datos real.

### Base de datos / Supabase

Hay un cliente en `src/lib/supabaseClient.ts` (`supabase`, `isSupabaseConfigured()`). Los datos del backoffice **siguen** en el navegador (`localStorage`) hasta que sustituyas los stores (`*Store.ts`) por tablas + RLS.

1. Copia `.env.example` a `.env` y pega la **anon key** (Dashboard → Project Settings → API).
2. **SQL inicial:** ejecuta el contenido de `supabase/migrations/20260206120000_initial_schema.sql` en **Supabase → SQL → New query → Run** (o `supabase db push` si usas la CLI). Crea tablas `providers`, `company_workers`, `clients`, `client_contact_persons`, `provider_contact_persons`, `backoffice_users`, enums, RLS para rol `authenticated` y triggers `updated_at`.
3. **Mapeo Postgres ↔ dominio:** tipos de fila en `src/types/database.ts`, funciones en `src/lib/supabase/mappers.ts` (p. ej. `clientRowToDomain`, `providerRecordToRowInsert`, `backofficeUserRowToDomain`).
4. Autenticación: enlaza `backoffice_users.auth_user_id` con `auth.users` (Supabase Auth); no hay columna de contraseña en `public` (solo en Auth).

Variables: `VITE_SUPABASE_URL` (por defecto el proyecto `grasrjavkbeboynacvzp`) y `VITE_SUPABASE_ANON_KEY`.

**GitHub + Supabase:** al subir cambios a `main`, GitHub Actions ejecuta CI (lint/build) y, si cambian migraciones, despliega el esquema con `supabase db push`. Configura los secretos del repositorio y el flujo de trabajo en [`CONTRIBUTING.md`](./CONTRIBUTING.md).
