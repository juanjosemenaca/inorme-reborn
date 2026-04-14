-- Módulo de facturación (MVP legal España): borrador, emisión, cobros, anulación, rectificativa,
-- hash encadenado y trazabilidad.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.billing_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER tr_billing_series_updated_at
  BEFORE UPDATE ON public.billing_series
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

INSERT INTO public.billing_series (code, label)
VALUES ('A', 'Serie general')
ON CONFLICT (code) DO NOTHING;

-- Datos fiscales del emisor (empresa).
CREATE TABLE public.billing_issuer_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  tax_id text NOT NULL,
  fiscal_address text NOT NULL,
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER tr_billing_issuer_profile_updated_at
  BEFORE UPDATE ON public.billing_issuer_profile
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Facturas: snapshot fiscal obligatorio para inmutabilidad legal.
CREATE TABLE public.billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.billing_series (id),
  fiscal_year int,
  invoice_number int,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ISSUED', 'PAID', 'CANCELLED')),
  payment_status text NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PARTIAL', 'PAID')),
  invoice_kind text NOT NULL DEFAULT 'NORMAL' CHECK (invoice_kind IN ('NORMAL', 'RECTIFICATIVE')),
  rectifies_invoice_id uuid REFERENCES public.billing_invoices (id) ON DELETE RESTRICT,
  issue_date date,
  issued_at timestamptz,
  due_date date,
  notes text NOT NULL DEFAULT '',

  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE RESTRICT,

  issuer_name text NOT NULL,
  issuer_tax_id text NOT NULL,
  issuer_fiscal_address text NOT NULL,

  recipient_name text NOT NULL,
  recipient_tax_id text NOT NULL,
  recipient_fiscal_address text NOT NULL,

  taxable_base_total numeric(14,2) NOT NULL DEFAULT 0,
  vat_total numeric(14,2) NOT NULL DEFAULT 0,
  irpf_total numeric(14,2) NOT NULL DEFAULT 0,
  grand_total numeric(14,2) NOT NULL DEFAULT 0,
  collected_total numeric(14,2) NOT NULL DEFAULT 0,

  previous_hash text,
  record_hash text,
  verifactu_qr_payload jsonb,
  verifactu_submission_status text NOT NULL DEFAULT 'PENDING' CHECK (verifactu_submission_status IN ('PENDING', 'SENT', 'ACCEPTED', 'REJECTED')),

  created_by_backoffice_user_id uuid REFERENCES public.backoffice_users (id) ON DELETE SET NULL,
  updated_by_backoffice_user_id uuid REFERENCES public.backoffice_users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_billing_invoice_number UNIQUE (series_id, fiscal_year, invoice_number),
  CONSTRAINT ck_billing_issue_number_data CHECK (
    (status = 'DRAFT' AND invoice_number IS NULL)
    OR (status <> 'DRAFT' AND invoice_number IS NOT NULL AND issue_date IS NOT NULL AND fiscal_year IS NOT NULL)
  )
);

CREATE INDEX idx_billing_invoices_status ON public.billing_invoices (status, issue_date DESC);
CREATE INDEX idx_billing_invoices_client ON public.billing_invoices (client_id, created_at DESC);

CREATE TRIGGER tr_billing_invoices_updated_at
  BEFORE UPDATE ON public.billing_invoices
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TABLE public.billing_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.billing_invoices (id) ON DELETE CASCADE,
  line_order int NOT NULL,
  description text NOT NULL,
  quantity numeric(14,4) NOT NULL DEFAULT 1,
  unit_price numeric(14,4) NOT NULL DEFAULT 0,
  vat_rate numeric(7,4) NOT NULL DEFAULT 21 CHECK (vat_rate IN (21, 10, 4)),
  irpf_rate numeric(7,4) NOT NULL DEFAULT 0,
  taxable_base numeric(14,2) NOT NULL DEFAULT 0,
  vat_amount numeric(14,2) NOT NULL DEFAULT 0,
  irpf_amount numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_billing_line_order UNIQUE (invoice_id, line_order)
);

CREATE TRIGGER tr_billing_invoice_lines_updated_at
  BEFORE UPDATE ON public.billing_invoice_lines
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TABLE public.billing_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.billing_invoices (id) ON DELETE RESTRICT,
  receipt_date date NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'BANK_TRANSFER',
  reference text,
  notes text NOT NULL DEFAULT '',
  created_by_backoffice_user_id uuid REFERENCES public.backoffice_users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_receipts_invoice ON public.billing_receipts (invoice_id, receipt_date DESC);

CREATE TABLE public.billing_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid,
  event_type text NOT NULL,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_backoffice_user_id uuid REFERENCES public.backoffice_users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_audit_entity ON public.billing_audit_logs (entity_type, entity_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.billing_prevent_invoice_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'No se permite eliminar facturas. Usa anulación o rectificativa.';
END;
$$;

DROP TRIGGER IF EXISTS tr_billing_prevent_invoice_delete ON public.billing_invoices;
CREATE TRIGGER tr_billing_prevent_invoice_delete
  BEFORE DELETE ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.billing_prevent_invoice_delete();

CREATE OR REPLACE FUNCTION public.billing_prevent_issued_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status <> 'DRAFT' THEN
    IF NEW.series_id <> OLD.series_id
      OR NEW.fiscal_year IS DISTINCT FROM OLD.fiscal_year
      OR NEW.invoice_number IS DISTINCT FROM OLD.invoice_number
      OR NEW.issue_date IS DISTINCT FROM OLD.issue_date
      OR NEW.client_id <> OLD.client_id
      OR NEW.issuer_tax_id <> OLD.issuer_tax_id
      OR NEW.recipient_tax_id <> OLD.recipient_tax_id
      OR NEW.taxable_base_total <> OLD.taxable_base_total
      OR NEW.vat_total <> OLD.vat_total
      OR NEW.irpf_total <> OLD.irpf_total
      OR NEW.grand_total <> OLD.grand_total
      OR NEW.record_hash IS DISTINCT FROM OLD.record_hash
      OR NEW.previous_hash IS DISTINCT FROM OLD.previous_hash
    THEN
      RAISE EXCEPTION 'Factura emitida/pagada/anulada: datos fiscales e integridad inmutables.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_billing_prevent_issued_mutation ON public.billing_invoices;
CREATE TRIGGER tr_billing_prevent_issued_mutation
  BEFORE UPDATE ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.billing_prevent_issued_mutation();

CREATE OR REPLACE FUNCTION public.billing_prevent_line_mutation_after_issue()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  inv_status text;
BEGIN
  SELECT status INTO inv_status
  FROM public.billing_invoices
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  IF inv_status IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF inv_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'No se pueden modificar líneas de factura fuera de borrador.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tr_billing_prevent_line_mutation_after_issue ON public.billing_invoice_lines;
CREATE TRIGGER tr_billing_prevent_line_mutation_after_issue
  BEFORE UPDATE OR DELETE ON public.billing_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.billing_prevent_line_mutation_after_issue();

CREATE OR REPLACE FUNCTION public.billing_recompute_line_derived_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_base numeric(14,2);
  v_vat numeric(14,2);
  v_irpf numeric(14,2);
BEGIN
  v_base := round((NEW.quantity * NEW.unit_price)::numeric, 2);
  v_vat := round((v_base * NEW.vat_rate / 100)::numeric, 2);
  v_irpf := round((v_base * NEW.irpf_rate / 100)::numeric, 2);
  NEW.taxable_base := v_base;
  NEW.vat_amount := v_vat;
  NEW.irpf_amount := v_irpf;
  NEW.line_total := round((v_base + v_vat - v_irpf)::numeric, 2);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_billing_recompute_line_derived_fields ON public.billing_invoice_lines;
CREATE TRIGGER tr_billing_recompute_line_derived_fields
  BEFORE INSERT OR UPDATE ON public.billing_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.billing_recompute_line_derived_fields();

CREATE OR REPLACE FUNCTION public.billing_emit_invoice(
  p_invoice_id uuid,
  p_actor_backoffice_user_id uuid,
  p_issue_date date DEFAULT CURRENT_DATE
)
RETURNS public.billing_invoices
LANGUAGE plpgsql
AS $$
DECLARE
  inv public.billing_invoices;
  v_series_code text;
  v_next_number int;
  v_prev_hash text;
  v_base_total numeric(14,2);
  v_vat_total numeric(14,2);
  v_irpf_total numeric(14,2);
  v_grand_total numeric(14,2);
  v_payload text;
  v_hash text;
  v_qr jsonb;
BEGIN
  SELECT * INTO inv
  FROM public.billing_invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada.';
  END IF;
  IF inv.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Solo se puede emitir una factura en borrador.';
  END IF;

  SELECT COALESCE(sum(taxable_base), 0), COALESCE(sum(vat_amount), 0), COALESCE(sum(irpf_amount), 0)
    INTO v_base_total, v_vat_total, v_irpf_total
  FROM public.billing_invoice_lines
  WHERE invoice_id = p_invoice_id;

  IF v_base_total <= 0 THEN
    RAISE EXCEPTION 'Factura sin líneas o con base imponible cero.';
  END IF;

  v_grand_total := round((v_base_total + v_vat_total - v_irpf_total)::numeric, 2);
  inv.fiscal_year := extract(year from COALESCE(p_issue_date, CURRENT_DATE));
  inv.issue_date := COALESCE(p_issue_date, CURRENT_DATE);

  SELECT code INTO v_series_code
  FROM public.billing_series
  WHERE id = inv.series_id;
  IF v_series_code IS NULL THEN
    RAISE EXCEPTION 'Serie no encontrada.';
  END IF;

  SELECT COALESCE(max(invoice_number), 0) + 1
    INTO v_next_number
  FROM public.billing_invoices
  WHERE series_id = inv.series_id
    AND fiscal_year = inv.fiscal_year
    AND status <> 'DRAFT';

  SELECT record_hash INTO v_prev_hash
  FROM public.billing_invoices
  WHERE series_id = inv.series_id
    AND fiscal_year = inv.fiscal_year
    AND status <> 'DRAFT'
  ORDER BY invoice_number DESC
  LIMIT 1;

  v_payload := concat_ws(
    '|',
    inv.issuer_tax_id,
    v_series_code,
    inv.fiscal_year::text,
    v_next_number::text,
    inv.issue_date::text,
    inv.recipient_tax_id,
    v_grand_total::text,
    COALESCE(v_prev_hash, '')
  );
  v_hash := encode(digest(v_payload, 'sha256'), 'hex');

  v_qr := jsonb_build_object(
    'schema', 'ES_VERIFACTU_PREP',
    'issuerTaxId', inv.issuer_tax_id,
    'invoiceId', inv.id,
    'series', v_series_code,
    'number', v_next_number,
    'fiscalYear', inv.fiscal_year,
    'issueDate', inv.issue_date,
    'amountTotal', v_grand_total,
    'hash', v_hash
  );

  UPDATE public.billing_invoices
    SET status = 'ISSUED',
        payment_status = 'PENDING',
        fiscal_year = inv.fiscal_year,
        invoice_number = v_next_number,
        issue_date = inv.issue_date,
        issued_at = now(),
        taxable_base_total = v_base_total,
        vat_total = v_vat_total,
        irpf_total = v_irpf_total,
        grand_total = v_grand_total,
        previous_hash = v_prev_hash,
        record_hash = v_hash,
        verifactu_qr_payload = v_qr,
        updated_by_backoffice_user_id = p_actor_backoffice_user_id,
        updated_at = now()
  WHERE id = p_invoice_id;

  INSERT INTO public.billing_audit_logs (entity_type, entity_id, event_type, event_payload, actor_backoffice_user_id)
  VALUES (
    'INVOICE',
    p_invoice_id,
    'ISSUED',
    jsonb_build_object(
      'series', v_series_code,
      'number', v_next_number,
      'fiscalYear', inv.fiscal_year,
      'issueDate', inv.issue_date,
      'taxableBase', v_base_total,
      'vatTotal', v_vat_total,
      'irpfTotal', v_irpf_total,
      'grandTotal', v_grand_total,
      'hash', v_hash,
      'previousHash', v_prev_hash
    ),
    p_actor_backoffice_user_id
  );

  RETURN (SELECT i FROM public.billing_invoices i WHERE i.id = p_invoice_id);
END;
$$;

ALTER TABLE public.billing_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_issuer_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backoffice_authenticated_all_billing_series"
  ON public.billing_series FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "backoffice_authenticated_all_billing_issuer_profile"
  ON public.billing_issuer_profile FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "backoffice_authenticated_all_billing_invoices"
  ON public.billing_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "backoffice_authenticated_all_billing_invoice_lines"
  ON public.billing_invoice_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "backoffice_authenticated_all_billing_receipts"
  ON public.billing_receipts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "backoffice_authenticated_all_billing_audit_logs"
  ON public.billing_audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.billing_invoices IS
  'Facturas clientes: borrador, emitida, pagada, anulada, hash encadenado y QR preparado para VeriFactu.';
COMMENT ON COLUMN public.billing_invoices.record_hash IS
  'Hash SHA-256 del registro emitido encadenado con previous_hash.';
COMMENT ON COLUMN public.billing_invoices.verifactu_qr_payload IS
  'Payload mínimo para QR trazable y futura integración con AEAT/VeriFactu.';

NOTIFY pgrst, 'reload schema';
