-- Borradores: permitir borrado físico siempre (descartar trabajo no emitido).
-- Facturas emitidas: se mantiene la restricción salvo modo pruebas (billing_runtime_settings).

CREATE OR REPLACE FUNCTION public.billing_prevent_invoice_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allow_delete boolean;
BEGIN
  IF OLD.status = 'DRAFT' THEN
    RETURN OLD;
  END IF;

  SELECT allow_invoice_delete_in_test
    INTO allow_delete
  FROM public.billing_runtime_settings
  WHERE id = true;

  IF COALESCE(allow_delete, false) THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'No se permite eliminar facturas emitidas. Usa anulación o rectificativa.';
END;
$$;

COMMENT ON FUNCTION public.billing_prevent_invoice_delete() IS
  'Permite DELETE en borradores; en facturas emitidas solo si allow_invoice_delete_in_test.';

NOTIFY pgrst, 'reload schema';
