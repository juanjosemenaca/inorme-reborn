-- Aviso al administrador cuando un trabajador añade un día de vacaciones en su calendario.

CREATE TABLE public.worker_vacation_day_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_worker_id uuid NOT NULL REFERENCES public.company_workers (id) ON DELETE CASCADE,
  calendar_year integer NOT NULL,
  vacation_date_added date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_worker_vacation_day_notifications_created
  ON public.worker_vacation_day_notifications (created_at DESC);

CREATE INDEX idx_worker_vacation_day_notifications_worker
  ON public.worker_vacation_day_notifications (company_worker_id);

COMMENT ON TABLE public.worker_vacation_day_notifications IS
  'Registro de días de vacaciones añadidos por el trabajador; el admin puede revisar la actividad reciente.';

ALTER TABLE public.worker_vacation_day_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backoffice_authenticated_all_worker_vacation_day_notifications"
  ON public.worker_vacation_day_notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.worker_vacation_day_notifications TO authenticated;

NOTIFY pgrst, 'reload schema';
