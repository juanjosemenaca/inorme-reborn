-- Ejecuta UNA LÍNEA (la del NOTIFY) en el SQL Editor de Supabase si ves:
--   "Could not find the table 'public.project_members' in the schema cache"
-- u otro "schema cache" justo después de aplicar migraciones o crear tablas.
-- Si el error continúa, la tabla aún no existe: ejecuta en orden las migraciones
-- que crean `project_members` (p. ej. `20260423130000_ensure_project_members.sql`)
-- y la de funciones de respaldo `20260423150000_project_members_rpc.sql`, y luego NOTIFY.
-- La app prioriza esas funciones para evitar fallos de caché de PostgREST sobre la tabla.
NOTIFY pgrst, 'reload schema';
