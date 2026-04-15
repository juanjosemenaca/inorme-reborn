-- Email y teléfono del emisor en snapshot de factura (PDF / inmutabilidad al emitir).

ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS issuer_email text,
  ADD COLUMN IF NOT EXISTS issuer_phone text;

COMMENT ON COLUMN public.billing_invoices.issuer_email IS
  'Email de contacto del emisor (copia en borrador; inmutable tras emitir).';
COMMENT ON COLUMN public.billing_invoices.issuer_phone IS
  'Teléfono de contacto del emisor (copia en borrador; inmutable tras emitir).';

UPDATE public.billing_invoices bi
SET
  issuer_email = COALESCE(bi.issuer_email, NULLIF(trim(i.email), '')),
  issuer_phone = COALESCE(bi.issuer_phone, NULLIF(trim(i.phone), ''))
FROM public.billing_issuers i
WHERE bi.issuer_id = i.id;

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
      OR NEW.issuer_logo_storage_path IS DISTINCT FROM OLD.issuer_logo_storage_path
      OR NEW.issuer_website_url IS DISTINCT FROM OLD.issuer_website_url
      OR NEW.issuer_privacy_footer IS DISTINCT FROM OLD.issuer_privacy_footer
      OR NEW.issuer_email IS DISTINCT FROM OLD.issuer_email
      OR NEW.issuer_phone IS DISTINCT FROM OLD.issuer_phone
      OR NEW.recipient_name <> OLD.recipient_name
      OR NEW.recipient_tax_id <> OLD.recipient_tax_id
      OR NEW.recipient_fiscal_address <> OLD.recipient_fiscal_address
      OR NEW.recipient_website_url IS DISTINCT FROM OLD.recipient_website_url
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

NOTIFY pgrst, 'reload schema';
