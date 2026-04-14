-- Tickets, facturas y fotos asociados a una hoja de gastos (Storage: project-documents).

CREATE TABLE public.worker_expense_sheet_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id uuid NOT NULL REFERENCES public.worker_expense_sheets (id) ON DELETE CASCADE,
  expense_date date NULL,
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  mime_type text,
  file_size_bytes int,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_backoffice_user_id uuid REFERENCES public.backoffice_users (id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX uq_worker_expense_sheet_attachments_storage_path
  ON public.worker_expense_sheet_attachments (storage_path);

CREATE INDEX idx_worker_expense_sheet_attachments_sheet
  ON public.worker_expense_sheet_attachments (sheet_id);

COMMENT ON TABLE public.worker_expense_sheet_attachments IS
  'Justificantes (PDF, imagen, foto) subidos con la hoja de gastos; accesibles en validación.';

ALTER TABLE public.worker_expense_sheet_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backoffice_authenticated_all_worker_expense_sheet_attachments"
  ON public.worker_expense_sheet_attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
