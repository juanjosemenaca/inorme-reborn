-- Fichajes horarios: entradas, salidas, pausas y ausencias.

CREATE TABLE IF NOT EXISTS public.worker_time_clock_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_worker_id uuid NOT NULL REFERENCES public.company_workers (id) ON DELETE CASCADE,
  event_kind text NOT NULL CHECK (event_kind IN ('CLOCK_IN', 'CLOCK_OUT', 'BREAK_START', 'BREAK_END', 'ABSENCE')),
  event_at timestamptz NOT NULL DEFAULT now(),
  absence_reason text,
  comment text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'WORKER' CHECK (source IN ('WORKER', 'ADMIN')),
  created_by_backoffice_user_id uuid REFERENCES public.backoffice_users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS tr_worker_time_clock_events_updated_at ON public.worker_time_clock_events;
CREATE TRIGGER tr_worker_time_clock_events_updated_at
  BEFORE UPDATE ON public.worker_time_clock_events
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_worker_time_clock_events_worker_at
  ON public.worker_time_clock_events (company_worker_id, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_worker_time_clock_events_created_by
  ON public.worker_time_clock_events (created_by_backoffice_user_id, created_at DESC);

COMMENT ON TABLE public.worker_time_clock_events IS
  'Eventos de fichaje horario por trabajador: entrada/salida, pausas, ausencias y comentarios.';

COMMENT ON COLUMN public.worker_time_clock_events.absence_reason IS
  'Motivo libre cuando el evento es de ausencia.';

ALTER TABLE public.worker_time_clock_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "backoffice_authenticated_all_worker_time_clock_events" ON public.worker_time_clock_events;
CREATE POLICY "backoffice_authenticated_all_worker_time_clock_events"
  ON public.worker_time_clock_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.worker_time_clock_events TO authenticated;

NOTIFY pgrst, 'reload schema';
