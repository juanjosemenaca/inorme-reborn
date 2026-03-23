-- Ejecuta esto en Supabase → SQL Editor para comprobar si el esquema Inorme está aplicado.
-- Deberías ver 6 tablas en public (y los tipos enum si existen).

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'providers',
    'company_workers',
    'clients',
    'client_contact_persons',
    'provider_contact_persons',
    'backoffice_users'
  )
ORDER BY table_name;

-- Si el resultado tiene 0 filas, aún no has aplicado la migración inicial.
