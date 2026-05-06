-- Asignación masiva de proveedor INORME para empleados FIJO/TEMPORAL/PRACTICAS.
-- Se aplica a todos los registros existentes con esos tipos.

DO $$
DECLARE
  v_inorme_provider_id uuid;
BEGIN
  SELECT p.id
  INTO v_inorme_provider_id
  FROM public.providers p
  WHERE p.active = true
    AND (
      upper(coalesce(p.trade_name, '')) LIKE '%INORME%'
      OR upper(coalesce(p.company_name, '')) LIKE '%INORME%'
      OR upper(coalesce(p.trade_name, '')) LIKE '%INFORME%'
      OR upper(coalesce(p.company_name, '')) LIKE '%INFORME%'
    )
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF v_inorme_provider_id IS NULL THEN
    RAISE EXCEPTION 'No existe proveedor activo INORME. Créalo/actívalo en providers antes de ejecutar esta migración.';
  END IF;

  UPDATE public.company_workers
  SET provider_id = v_inorme_provider_id,
      updated_at = now()
  WHERE employment_type IN ('FIJO', 'TEMPORAL', 'PRACTICAS');
END $$;

