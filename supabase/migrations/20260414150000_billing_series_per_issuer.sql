-- Cada serie de facturación pertenece a un emisor; el código es único por emisor.

ALTER TABLE public.billing_series
  ADD COLUMN issuer_id uuid REFERENCES public.billing_issuers (id) ON DELETE RESTRICT;

UPDATE public.billing_series bs
SET issuer_id = (SELECT id FROM public.billing_issuers WHERE code = 'DEFAULT' LIMIT 1)
WHERE bs.issuer_id IS NULL;

ALTER TABLE public.billing_series
  ALTER COLUMN issuer_id SET NOT NULL;

ALTER TABLE public.billing_series
  DROP CONSTRAINT IF EXISTS billing_series_code_key;

ALTER TABLE public.billing_series
  ADD CONSTRAINT uq_billing_series_issuer_code UNIQUE (issuer_id, code);

CREATE INDEX idx_billing_series_issuer ON public.billing_series (issuer_id);

CREATE OR REPLACE FUNCTION public.billing_enforce_series_belongs_to_issuer()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_series_issuer uuid;
BEGIN
  SELECT issuer_id INTO v_series_issuer
  FROM public.billing_series
  WHERE id = NEW.series_id;

  IF v_series_issuer IS NULL THEN
    RAISE EXCEPTION 'Serie no encontrada.';
  END IF;

  IF v_series_issuer <> NEW.issuer_id THEN
    RAISE EXCEPTION 'La serie de facturación debe pertenecer al mismo emisor que la factura.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_billing_series_belongs_to_issuer ON public.billing_invoices;
CREATE TRIGGER tr_billing_series_belongs_to_issuer
  BEFORE INSERT OR UPDATE OF series_id, issuer_id ON public.billing_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.billing_enforce_series_belongs_to_issuer();

COMMENT ON COLUMN public.billing_series.issuer_id IS
  'Emisor al que pertenece la serie; la numeración correlativa es por emisor y serie.';

NOTIFY pgrst, 'reload schema';
