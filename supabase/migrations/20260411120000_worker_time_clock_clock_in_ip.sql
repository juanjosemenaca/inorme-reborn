-- IP pública del cliente al registrar inicio de jornada (CLOCK_IN); solo consulta administración en detalle.

ALTER TABLE public.worker_time_clock_events
  ADD COLUMN IF NOT EXISTS clock_in_client_ip text;

COMMENT ON COLUMN public.worker_time_clock_events.clock_in_client_ip IS
  'IP pública obtenida en el navegador al fichar entrada; uso interno, visible solo en backoffice admin.';

NOTIFY pgrst, 'reload schema';
