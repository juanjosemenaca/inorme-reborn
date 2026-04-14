-- Logo opcional por emisor (ruta en Storage); copia en factura para inmutabilidad tras emisión.

ALTER TABLE public.billing_issuers
  ADD COLUMN IF NOT EXISTS logo_storage_path text;

COMMENT ON COLUMN public.billing_issuers.logo_storage_path IS
  'Ruta en bucket project-documents (prefijo billing-issuer-logos/…).';

ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS issuer_logo_storage_path text;

COMMENT ON COLUMN public.billing_invoices.issuer_logo_storage_path IS
  'Copia del logo del emisor al crear/editar borrador; inmutable tras emitir.';

UPDATE public.billing_invoices bi
SET issuer_logo_storage_path = i.logo_storage_path
FROM public.billing_issuers i
WHERE bi.issuer_id = i.id
  AND bi.issuer_logo_storage_path IS NULL
  AND i.logo_storage_path IS NOT NULL;

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

NOTIFY pgrst, 'reload schema';
