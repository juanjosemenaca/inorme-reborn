# Back Office Attis (instancia independiente)

El código es el mismo que el backoffice Inorme, pero **los datos y usuarios están totalmente separados** si usas **otro proyecto Supabase** y un **despliegue** (por ejemplo otro proyecto en Vercel) con variables distintas.

## Qué hace el repositorio

- Con `VITE_BACKOFFICE_PRODUCT=ATTIS` (y traducciones `layout_attis` / `login_attis`) la interfaz muestra **Back Office Attis** en login, cabeceras y título del navegador.
- Sin esa variable (o con `INORME`), el comportamiento es el de siempre.

La separación real de trabajadores y cuentas **no** es solo la variable de producto: debe existir una **base de datos y Auth aislados**.

## Pasos recomendados

### 1. Nuevo proyecto en Supabase

1. Crea un proyecto nuevo en [Supabase](https://supabase.com/dashboard).
2. Aplica el mismo esquema que Inorme:
   - Con CLI: `supabase link` al proyecto Attis y `supabase db push`, **o**
   - Ejecuta las migraciones de `supabase/migrations/` en el SQL Editor en orden.
3. En **Authentication → Providers**, habilita email/contraseña como en el proyecto actual.
4. Crea el primer administrador (Auth + fila en `backoffice_users`) siguiendo el flujo de `supabase/BOOTSTRAP_FIRST_ADMIN.sql` o la documentación interna de alta de usuarios.

### 2. Nuevo despliegue del front (Vercel u otro)

1. Puede ser el **mismo repositorio Git** que Inorme.
2. Crea un **nuevo proyecto** de hosting (no reutilices el de Inorme si quieres URLs y entornos claros).
3. Variables de entorno de **producción** para Attis:

| Variable | Valor |
|----------|--------|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase **Attis** |
| `VITE_SUPABASE_ANON_KEY` | anon public del proyecto **Attis** |
| `VITE_BACKOFFICE_PRODUCT` | `ATTIS` |

4. Despliega (build de Vite). El cliente solo hablará con el Supabase que indiques.

### 3. Dominio (opcional)

Asigna un dominio dedicado (por ejemplo `attis.tudominio.com`) al proyecto Vercel de Attis.

### 4. Probar en local

En `.env.local`:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO-ATTIS.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_BACKOFFICE_PRODUCT=ATTIS
```

Luego `npm run dev` y entra en `/admin/login`.

## Multi-tenant en una sola base de datos

No está implementado: el esquema actual no lleva `tenant_id` en todas las tablas ni políticas RLS por organización. Si en el futuro quisieras **un solo Supabase** para Inorme y Attis, habría que diseñar multi-tenancy en base de datos y revisar todas las políticas y APIs.

## Resumen

| Inorme | Attis |
|--------|--------|
| Proyecto Supabase A | Proyecto Supabase B |
| `VITE_BACKOFFICE_PRODUCT` omitida o `INORME` | `VITE_BACKOFFICE_PRODUCT=ATTIS` |
| Misma app, otro build / otro hosting | |
