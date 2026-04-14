-- Modo pruebas: permitir borrado físico de facturas mientras se valida el flujo.
-- Para volver a modo legal, poner allow_invoice_delete_in_test = false.

CREATE TABLE IF NOT EXISTS public.billing_runtime_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  allow_invoice_delete_in_test boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.billing_runtime_settings (id, allow_invoice_delete_in_test)
VALUES (true, true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.billing_runtime_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "backoffice_authenticated_all_billing_runtime_settings" ON public.billing_runtime_settings;
CREATE POLICY "backoffice_authenticated_all_billing_runtime_settings"
  ON public.billing_runtime_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.billing_prevent_invoice_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allow_delete boolean;
BEGIN
  SELECT allow_invoice_delete_in_test
    INTO allow_delete
  FROM public.billing_runtime_settings
  WHERE id = true;

  IF COALESCE(allow_delete, false) THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'No se permite eliminar facturas. Usa anulación o rectificativa.';
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_set_runtime_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_billing_runtime_settings_updated_at ON public.billing_runtime_settings;
CREATE TRIGGER tr_billing_runtime_settings_updated_at
  BEFORE UPDATE ON public.billing_runtime_settings
  FOR EACH ROW EXECUTE FUNCTION public.billing_set_runtime_settings_updated_at();

NOTIFY pgrst, 'reload schema';
