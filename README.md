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

Este repositorio **no incluye aún el cliente de Supabase**. Los datos del backoffice viven en el navegador (`localStorage`). Para usar **Supabase** en producción habría que: crear el proyecto en [supabase.com](https://supabase.com), definir tablas equivalentes a los tipos en `src/types/`, sustituir los stores (`*Store.ts`) por llamadas a la API de Supabase y mover la autenticación al servidor (p. ej. Auth de Supabase + RLS). Variables de entorno: ver `.env.example`.
