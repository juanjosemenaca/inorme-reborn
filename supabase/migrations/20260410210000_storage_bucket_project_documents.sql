-- Bucket privado para documentos de proyecto y PDFs de hojas de gastos validadas.
-- Sin esto, Storage devuelve «Bucket not found» al subir ficheros desde la app.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-documents',
  'project-documents',
  false,
  52428800,
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- Políticas: usuarios autenticados (backoffice) pueden gestionar objetos en este bucket.
DROP POLICY IF EXISTS "project_documents_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "project_documents_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "project_documents_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "project_documents_delete_authenticated" ON storage.objects;

CREATE POLICY "project_documents_select_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-documents');

CREATE POLICY "project_documents_insert_authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-documents');

CREATE POLICY "project_documents_update_authenticated"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'project-documents')
  WITH CHECK (bucket_id = 'project-documents');

CREATE POLICY "project_documents_delete_authenticated"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-documents');
