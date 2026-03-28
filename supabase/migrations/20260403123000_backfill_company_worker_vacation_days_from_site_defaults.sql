-- Backfill puntual: al instalar el trigger en una BD que ya tenía sedes modificadas,
-- sincronizar una vez el cupo de trabajadores con el valor actual de su sede.

UPDATE public.company_workers cw
SET vacation_days = s.vacation_days_default
FROM public.work_calendar_sites s
WHERE cw.work_calendar_site_id = s.id
  AND cw.vacation_days IS DISTINCT FROM s.vacation_days_default;
