-- Facturación multi-emisor: varias razones sociales del grupo, correlativo y hash por emisor.

CREATE TABLE public.billing_issuers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  legal_name text NOT NULL,
  tax_id text NOT NULL,
  fiscal_address text NOT NULL,
  bank_account_iban text,
  bank_account_swift text,
  bank_name text,
  email text,
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_billing_issuers_code UNIQUE (code)
);

CREATE TRIGGER tr_billing_issuers_updated_at
  BEFORE UPDATE ON public.billing_issuers
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Migra el perfil único histórico.
INSERT INTO public.billing_issuers (code, legal_name, tax_id, fiscal_address, bank_account_iban, bank_account_swift, bank_name, email, phone)
SELECT
  'DEFAULT',
  legal_name,
  tax_id,
  fiscal_address,
  bank_account_iban,
  bank_account_swift,
  bank_name,
  email,
  phone
FROM public.billing_issuer_profile
ORDER BY created_at
LIMIT 1;

-- Si no había fila en el perfil antiguo, crea un marcador para poder enlazar facturas.
INSERT INTO public.billing_issuers (code, legal_name, tax_id, fiscal_address, active)
SELECT 'DEFAULT', 'Emisor pendiente de configuración', 'PENDIENTE', 'Pendiente', true
WHERE NOT EXISTS (SELECT 1 FROM public.billing_issuers WHERE code = 'DEFAULT');

ALTER TABLE public.billing_invoices
  ADD COLUMN issuer_id uuid REFERENCES public.billing_issuers (id) ON DELETE RESTRICT;

UPDATE public.billing_invoices bi
SET issuer_id = (SELECT id FROM public.billing_issuers WHERE code = 'DEFAULT' LIMIT 1)
WHERE bi.issuer_id IS NULL;

ALTER TABLE public.billing_invoices
  ALTER COLUMN issuer_id SET NOT NULL;

ALTER TABLE public.billing_invoices
  DROP CONSTRAINT uq_billing_invoice_number;

ALTER TABLE public.billing_invoices
  ADD CONSTRAINT uq_billing_invoice_number UNIQUE (issuer_id, series_id, fiscal_year, invoice_number);

DROP POLICY IF EXISTS "backoffice_authenticated_all_billing_issuer_profile" ON public.billing_issuer_profile;
DROP TABLE public.billing_issuer_profile;

ALTER TABLE public.billing_issuers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "backoffice_authenticated_all_billing_issuers" ON public.billing_issuers;
CREATE POLICY "backoffice_authenticated_all_billing_issuers"
  ON public.billing_issuers FOR ALL TO authenticated
  USING (public.is_backoffice_authenticated())
  WITH CHECK (public.is_backoffice_authenticated());

COMMENT ON TABLE public.billing_issuers IS
  'Emisores legales de factura (grupo empresarial): datos fiscales y de cobro por razón social.';
COMMENT ON COLUMN public.billing_invoices.issuer_id IS
  'Emisor legal de la factura; correlativo de numeración y cadena de hash son por emisor.';

CREATE INDEX idx_billing_invoices_issuer_series_year_status
  ON public.billing_invoices (issuer_id, series_id, fiscal_year, status)
  WHERE status <> 'DRAFT';

CREATE OR REPLACE FUNCTION public.billing_prevent_issued_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_emit_context boolean := COALESCE(current_setting('app.billing_emit_context', true), '') = '1';
BEGIN
  IF OLD.status = 'DRAFT' AND NEW.status <> 'DRAFT' THEN
    IF NOT (NEW.status = 'ISSUED' AND v_emit_context) THEN
      RAISE EXCEPTION 'No se permite cambiar estado desde borrador fuera del proceso de emisión.';
    END IF;
  END IF;
  IF OLD.status = 'CANCELLED' AND NEW.status <> 'CANCELLED' THEN
    RAISE EXCEPTION 'Una factura anulada no puede volver a otro estado.';
  END IF;
  IF OLD.status = 'ISSUED' AND NEW.status = 'DRAFT' THEN
    RAISE EXCEPTION 'No se permite volver de emitida a borrador.';
  END IF;
  IF OLD.status = 'PAID' AND NEW.status IN ('DRAFT', 'ISSUED') THEN
    RAISE EXCEPTION 'No se permite revertir una factura cobrada.';
  END IF;
  IF NEW.collected_total < OLD.collected_total THEN
    RAISE EXCEPTION 'No se permite reducir el total cobrado.';
  END IF;
  IF NEW.status = 'PAID' AND NEW.payment_status <> 'PAID' THEN
    RAISE EXCEPTION 'Estado PAID requiere payment_status=PAID.';
  END IF;
  IF NEW.payment_status = 'PAID' AND NEW.collected_total < NEW.grand_total THEN
    RAISE EXCEPTION 'payment_status=PAID requiere collected_total >= grand_total.';
  END IF;
  IF NEW.payment_status = 'PARTIAL' AND (NEW.collected_total <= 0 OR NEW.collected_total >= NEW.grand_total) THEN
    RAISE EXCEPTION 'payment_status=PARTIAL requiere 0 < collected_total < grand_total.';
  END IF;
  IF NEW.payment_status = 'PENDING' AND NEW.collected_total <> 0 THEN
    RAISE EXCEPTION 'payment_status=PENDING requiere collected_total = 0.';
  END IF;

  IF OLD.status <> 'DRAFT' THEN
    IF NEW.series_id <> OLD.series_id
      OR NEW.issuer_id <> OLD.issuer_id
      OR NEW.fiscal_year IS DISTINCT FROM OLD.fiscal_year
      OR NEW.invoice_number IS DISTINCT FROM OLD.invoice_number
      OR NEW.issue_date IS DISTINCT FROM OLD.issue_date
      OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
      OR NEW.client_id <> OLD.client_id
      OR NEW.issuer_name <> OLD.issuer_name
      OR NEW.issuer_tax_id <> OLD.issuer_tax_id
      OR NEW.issuer_fiscal_address <> OLD.issuer_fiscal_address
      OR NEW.issuer_bank_account_iban IS DISTINCT FROM OLD.issuer_bank_account_iban
      OR NEW.issuer_bank_account_swift IS DISTINCT FROM OLD.issuer_bank_account_swift
      OR NEW.issuer_bank_name IS DISTINCT FROM OLD.issuer_bank_name
      OR NEW.recipient_name <> OLD.recipient_name
      OR NEW.recipient_tax_id <> OLD.recipient_tax_id
      OR NEW.recipient_fiscal_address <> OLD.recipient_fiscal_address
      OR NEW.taxable_base_total <> OLD.taxable_base_total
      OR NEW.vat_total <> OLD.vat_total
      OR NEW.irpf_total <> OLD.irpf_total
      OR NEW.grand_total <> OLD.grand_total
      OR NEW.record_hash IS DISTINCT FROM OLD.record_hash
      OR NEW.previous_hash IS DISTINCT FROM OLD.previous_hash
      OR NEW.verifactu_qr_payload IS DISTINCT FROM OLD.verifactu_qr_payload
    THEN
      RAISE EXCEPTION 'Factura emitida/pagada/anulada: datos fiscales e integridad inmutables.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

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
  v_lines_payload jsonb;
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
  WHERE invoice_id = p_invoice_id
    AND line_type = 'BILLABLE';

  IF v_base_total <= 0 THEN
    RAISE EXCEPTION 'Factura sin líneas facturables o con base imponible cero.';
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
  WHERE issuer_id = inv.issuer_id
    AND series_id = inv.series_id
    AND fiscal_year = inv.fiscal_year
    AND status <> 'DRAFT';

  SELECT record_hash INTO v_prev_hash
  FROM public.billing_invoices
  WHERE issuer_id = inv.issuer_id
    AND series_id = inv.series_id
    AND fiscal_year = inv.fiscal_year
    AND status <> 'DRAFT'
  ORDER BY invoice_number DESC
  LIMIT 1;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'order', l.line_order,
        'lineType', l.line_type,
        'description', l.description,
        'quantity', l.quantity,
        'unitPrice', l.unit_price,
        'vatRate', l.vat_rate,
        'irpfRate', l.irpf_rate,
        'taxableBase', l.taxable_base,
        'vatAmount', l.vat_amount,
        'irpfAmount', l.irpf_amount,
        'lineTotal', l.line_total
      )
      ORDER BY l.line_order
    ),
    '[]'::jsonb
  ) INTO v_lines_payload
  FROM public.billing_invoice_lines l
  WHERE l.invoice_id = p_invoice_id;

  v_payload := jsonb_build_object(
    'issuerId', inv.issuer_id,
    'issuerTaxId', inv.issuer_tax_id,
    'issuerName', inv.issuer_name,
    'issuerFiscalAddress', inv.issuer_fiscal_address,
    'issuerBankIban', COALESCE(inv.issuer_bank_account_iban, ''),
    'issuerBankSwift', COALESCE(inv.issuer_bank_account_swift, ''),
    'issuerBankName', COALESCE(inv.issuer_bank_name, ''),
    'recipientTaxId', inv.recipient_tax_id,
    'recipientName', inv.recipient_name,
    'recipientFiscalAddress', inv.recipient_fiscal_address,
    'series', v_series_code,
    'fiscalYear', inv.fiscal_year,
    'invoiceNumber', v_next_number,
    'issueDate', inv.issue_date,
    'totals', jsonb_build_object(
      'taxableBase', v_base_total,
      'vatTotal', v_vat_total,
      'irpfTotal', v_irpf_total,
      'grandTotal', v_grand_total
    ),
    'lines', v_lines_payload,
    'previousHash', COALESCE(v_prev_hash, '')
  )::text;
  v_hash := encode(digest(v_payload, 'sha256'), 'hex');

  v_qr := jsonb_build_object(
    'schema', 'ES_VERIFACTU_PREP',
    'issuerId', inv.issuer_id,
    'issuerTaxId', inv.issuer_tax_id,
    'invoiceId', inv.id,
    'series', v_series_code,
    'number', v_next_number,
    'fiscalYear', inv.fiscal_year,
    'issueDate', inv.issue_date,
    'amountTotal', v_grand_total,
    'hash', v_hash
  );

  PERFORM set_config('app.billing_emit_context', '1', true);

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
      'issuerId', inv.issuer_id,
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

NOTIFY pgrst, 'reload schema';
