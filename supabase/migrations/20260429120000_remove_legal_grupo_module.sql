-- Retira el módulo Grupo Legal: tablas, bucket de documentos, políticas RLS y clave LEGAL en módulos.

-- Storage: quitar objetos y bucket (Supabase exige habilitar borrado SQL explícito)
DROP POLICY IF EXISTS "legal_documents_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "legal_documents_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "legal_documents_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "legal_documents_delete_authenticated" ON storage.objects;

DO $cleanup_legal_storage$
BEGIN
  -- storage.protect_delete() (versiones recientes: storage.can_delete; antiguas: storage.allow_delete_query)
  PERFORM set_config('storage.can_delete', 'true', true);
  PERFORM set_config('storage.allow_delete_query', 'true', true);

  DELETE FROM storage.objects WHERE bucket_id = 'legal-documents';

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'storage'
      AND table_name = 'prefixes'
  ) THEN
    DELETE FROM storage.prefixes WHERE bucket_id = 'legal-documents';
  END IF;

  DELETE FROM storage.buckets WHERE id = 'legal-documents';
END;
$cleanup_legal_storage$;

-- Tablas (orden: dependientes primero)
DROP TABLE IF EXISTS public.legal_invoice_lines CASCADE;
DROP TABLE IF EXISTS public.legal_invoices CASCADE;
DROP TABLE IF EXISTS public.legal_time_entries CASCADE;
DROP TABLE IF EXISTS public.legal_calendar_events CASCADE;
DROP TABLE IF EXISTS public.legal_documents CASCADE;
DROP TABLE IF EXISTS public.legal_procedures CASCADE;
DROP TABLE IF EXISTS public.legal_matter_activities CASCADE;
DROP TABLE IF EXISTS public.legal_matters CASCADE;
DROP TABLE IF EXISTS public.legal_contacts CASCADE;
DROP TABLE IF EXISTS public.legal_client_links CASCADE;
DROP TABLE IF EXISTS public.legal_audit_logs CASCADE;
DROP TABLE IF EXISTS public.legal_clients CASCADE;

-- Quitar LEGAL del CHECK de backoffice_users (solo si existe la tabla; p. ej. CLI en proyecto distinto)
DO $fix_backoffice_modules$
BEGIN
  IF to_regclass('public.backoffice_users') IS NULL THEN
    RAISE NOTICE 'remove_legal_grupo: omitido ajuste de enabled_modules (no existe public.backoffice_users)';
    RETURN;
  END IF;

  ALTER TABLE public.backoffice_users
    DROP CONSTRAINT IF EXISTS backoffice_users_enabled_modules_valid;

  UPDATE public.backoffice_users AS u
  SET enabled_modules = COALESCE(
    (
      SELECT array_agg(DISTINCT elem)
      FROM unnest(u.enabled_modules) AS elem
      WHERE elem IN (
        'VACATIONS',
        'MESSAGES',
        'TIME_CLOCK',
        'AGENDA',
        'GASTOS'
      )
    ),
    ARRAY[]::text[]
  );

  UPDATE public.backoffice_users
  SET enabled_modules = ARRAY['VACATIONS', 'MESSAGES', 'TIME_CLOCK', 'AGENDA', 'GASTOS']::text[]
  WHERE cardinality(enabled_modules) = 0;

  ALTER TABLE public.backoffice_users
    ADD CONSTRAINT backoffice_users_enabled_modules_valid
    CHECK (
      enabled_modules <@ ARRAY[
        'VACATIONS',
        'MESSAGES',
        'TIME_CLOCK',
        'AGENDA',
        'GASTOS'
      ]::text[]
    );
END;
$fix_backoffice_modules$;

NOTIFY pgrst, 'reload schema';
