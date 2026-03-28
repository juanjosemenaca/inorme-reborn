-- Al cambiar los días de vacaciones por defecto de una sede, actualizar el cupo en todas las fichas de trabajadores de esa sede.
-- Así el listado de Vacaciones y el resto de la app ven el mismo valor aunque falle el cliente o haya caché.

CREATE OR REPLACE FUNCTION public.sync_company_workers_vacation_days_from_site()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.vacation_days_default IS DISTINCT FROM OLD.vacation_days_default THEN
    UPDATE public.company_workers
    SET vacation_days = NEW.vacation_days_default
    WHERE work_calendar_site_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_work_calendar_sites_sync_worker_vacation_days ON public.work_calendar_sites;

CREATE TRIGGER tr_work_calendar_sites_sync_worker_vacation_days
  AFTER UPDATE OF vacation_days_default ON public.work_calendar_sites
  FOR EACH ROW
  EXECUTE PROCEDURE public.sync_company_workers_vacation_days_from_site();

COMMENT ON FUNCTION public.sync_company_workers_vacation_days_from_site() IS
  'Propaga vacation_days_default de work_calendar_sites a company_workers.vacation_days para esa sede.';
