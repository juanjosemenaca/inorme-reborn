-- PDF generado y guardado en Storage al validar una hoja de gastos.

ALTER TABLE public.worker_expense_sheets
  ADD COLUMN IF NOT EXISTS pdf_storage_path text,
  ADD COLUMN IF NOT EXISTS pdf_generated_at timestamptz;

COMMENT ON COLUMN public.worker_expense_sheets.pdf_storage_path IS
  'Ruta en Storage (bucket project-documents) del PDF oficial tras validación.';

COMMENT ON COLUMN public.worker_expense_sheets.pdf_generated_at IS
  'Momento en que se generó y guardó el PDF validado.';

NOTIFY pgrst, 'reload schema';
