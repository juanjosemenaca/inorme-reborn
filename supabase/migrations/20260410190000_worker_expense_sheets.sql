-- Hojas de gastos por trabajador: borrador, envío, validación por administración.

CREATE TABLE public.worker_expense_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_worker_id uuid NOT NULL REFERENCES public.company_workers (id) ON DELETE CASCADE,
  period_kind text NOT NULL CHECK (period_kind IN ('MONTH', 'CUSTOM')),
  calendar_year int,
  calendar_month int CHECK (calendar_month IS NULL OR (calendar_month >= 1 AND calendar_month <= 12)),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (
    status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')
  ),
  observations text NOT NULL DEFAULT '',
  submitted_at timestamptz,
  reviewed_by_backoffice_user_id uuid REFERENCES public.backoffice_users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_expense_sheets_period_dates CHECK (period_start <= period_end),
  CONSTRAINT worker_expense_sheets_month_consistency CHECK (
    (period_kind = 'MONTH' AND calendar_year IS NOT NULL AND calendar_month IS NOT NULL)
    OR (period_kind = 'CUSTOM' AND calendar_year IS NULL AND calendar_month IS NULL)
  )
);

CREATE UNIQUE INDEX uq_worker_expense_sheets_worker_period
  ON public.worker_expense_sheets (company_worker_id, period_start, period_end);

CREATE INDEX idx_worker_expense_sheets_worker_status
  ON public.worker_expense_sheets (company_worker_id, status);

CREATE INDEX idx_worker_expense_sheets_status_submitted
  ON public.worker_expense_sheets (status, submitted_at DESC)
  WHERE status = 'SUBMITTED';

COMMENT ON TABLE public.worker_expense_sheets IS
  'Hoja de gastos por periodo; el trabajador rellena y envía; administración aprueba o rechaza.';

CREATE TABLE public.worker_expense_sheet_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id uuid NOT NULL REFERENCES public.worker_expense_sheets (id) ON DELETE CASCADE,
  expense_date date NOT NULL,
  amount_tickets numeric(14, 2) NOT NULL DEFAULT 0,
  amount_taxis_parking numeric(14, 2) NOT NULL DEFAULT 0,
  amount_kms_fuel numeric(14, 2) NOT NULL DEFAULT 0,
  amount_toll numeric(14, 2) NOT NULL DEFAULT 0,
  amount_per_diem numeric(14, 2) NOT NULL DEFAULT 0,
  amount_hotel numeric(14, 2) NOT NULL DEFAULT 0,
  amount_supplies numeric(14, 2) NOT NULL DEFAULT 0,
  amount_other numeric(14, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_worker_expense_sheet_lines_sheet_date UNIQUE (sheet_id, expense_date)
);

CREATE INDEX idx_worker_expense_sheet_lines_sheet ON public.worker_expense_sheet_lines (sheet_id);

CREATE TRIGGER tr_worker_expense_sheets_updated_at
  BEFORE UPDATE ON public.worker_expense_sheets
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER tr_worker_expense_sheet_lines_updated_at
  BEFORE UPDATE ON public.worker_expense_sheet_lines
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.worker_expense_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_expense_sheet_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backoffice_authenticated_all_worker_expense_sheets"
  ON public.worker_expense_sheets FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "backoffice_authenticated_all_worker_expense_sheet_lines"
  ON public.worker_expense_sheet_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Módulo GASTOS (hojas de gastos) en usuarios backoffice.
ALTER TABLE public.backoffice_users
  DROP CONSTRAINT IF EXISTS backoffice_users_enabled_modules_valid;

ALTER TABLE public.backoffice_users
  ADD CONSTRAINT backoffice_users_enabled_modules_valid
  CHECK (
    enabled_modules <@ ARRAY['VACATIONS', 'MESSAGES', 'TIME_CLOCK', 'AGENDA', 'GASTOS']::text[]
  );

NOTIFY pgrst, 'reload schema';
