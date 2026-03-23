-- Cada trabajador tiene asignada una sede / calendario laboral (mismo enum que festivos y horario verano).

ALTER TABLE public.company_workers
  ADD COLUMN IF NOT EXISTS work_calendar_scope public.work_calendar_scope NOT NULL DEFAULT 'BARCELONA';

COMMENT ON COLUMN public.company_workers.work_calendar_scope IS
  'Calendario laboral corporativo (festivos y horario de verano) según sede.';

CREATE INDEX IF NOT EXISTS idx_company_workers_work_calendar_scope
  ON public.company_workers (work_calendar_scope);

NOTIFY pgrst, 'reload schema';
