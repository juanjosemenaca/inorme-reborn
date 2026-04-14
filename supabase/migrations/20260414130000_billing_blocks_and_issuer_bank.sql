-- Jerarquía de líneas de factura + datos de abono del emisor.

ALTER TABLE public.billing_issuer_profile
  ADD COLUMN IF NOT EXISTS bank_account_iban text,
  ADD COLUMN IF NOT EXISTS bank_account_swift text,
  ADD COLUMN IF NOT EXISTS bank_name text;

ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS issuer_bank_account_iban text,
  ADD COLUMN IF NOT EXISTS issuer_bank_account_swift text,
  ADD COLUMN IF NOT EXISTS issuer_bank_name text;

UPDATE public.billing_invoices bi
SET
  issuer_bank_account_iban = COALESCE(bi.issuer_bank_account_iban, bip.bank_account_iban),
  issuer_bank_account_swift = COALESCE(bi.issuer_bank_account_swift, bip.bank_account_swift),
  issuer_bank_name = COALESCE(bi.issuer_bank_name, bip.bank_name)
FROM public.billing_issuer_profile bip
WHERE bi.issuer_bank_account_iban IS NULL
   OR bi.issuer_bank_account_swift IS NULL
   OR bi.issuer_bank_name IS NULL;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.billing_invoice_lines'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%line_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.billing_invoice_lines DROP CONSTRAINT %I', r.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.billing_invoice_lines
  ALTER COLUMN line_type SET DEFAULT 'BILLABLE';

ALTER TABLE public.billing_invoice_lines
  ADD CONSTRAINT ck_billing_invoice_line_type
  CHECK (line_type IN ('BILLABLE', 'BLOCK_TITLE', 'BLOCK_SUBTITLE', 'CONCEPT'));

ALTER TABLE public.billing_invoice_lines
  ADD CONSTRAINT ck_billing_invoice_line_non_billable_amounts
  CHECK (
    line_type = 'BILLABLE'
    OR (
      quantity = 0
      AND unit_price = 0
      AND irpf_rate = 0
      AND taxable_base = 0
      AND vat_amount = 0
      AND irpf_amount = 0
      AND line_total = 0
    )
  );

CREATE OR REPLACE FUNCTION public.billing_recompute_line_derived_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_base numeric(14,2);
  v_vat numeric(14,2);
  v_irpf numeric(14,2);
BEGIN
  IF NEW.line_type <> 'BILLABLE' THEN
    NEW.quantity := 0;
    NEW.unit_price := 0;
    NEW.irpf_rate := 0;
    NEW.taxable_base := 0;
    NEW.vat_amount := 0;
    NEW.irpf_amount := 0;
    NEW.line_total := 0;
    RETURN NEW;
  END IF;

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

COMMENT ON COLUMN public.billing_invoice_lines.line_type IS
  'BILLABLE: línea facturable; BLOCK_TITLE/BLOCK_SUBTITLE/CONCEPT: separadores sin importes.';
COMMENT ON COLUMN public.billing_issuer_profile.bank_account_iban IS
  'IBAN de cobro del emisor para mostrar en factura.';
COMMENT ON COLUMN public.billing_issuer_profile.bank_account_swift IS
  'SWIFT/BIC de la cuenta de cobro del emisor.';
COMMENT ON COLUMN public.billing_issuer_profile.bank_name IS
  'Entidad bancaria de la cuenta de cobro del emisor.';

NOTIFY pgrst, 'reload schema';
