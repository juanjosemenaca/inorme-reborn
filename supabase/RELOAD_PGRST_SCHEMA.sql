-- Ejecuta esto en el SQL Editor de Supabase si ves errores de "schema cache"
-- tras crear tablas a mano o si PostgREST no refrescó (sin volver a crear tablas).
NOTIFY pgrst, 'reload schema';
