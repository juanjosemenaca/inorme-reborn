-- Agenda virtual por trabajador: recordatorios, eventos, reuniones y notas de administración.

CREATE TABLE public.worker_agenda_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_worker_id uuid NOT NULL REFERENCES public.company_workers (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  item_type text NOT NULL CHECK (
    item_type IN ('reminder', 'event', 'meeting', 'other', 'admin_note')
  ),
  source text NOT NULL CHECK (source IN ('WORKER', 'ADMIN')) DEFAULT 'WORKER',
  created_by_backoffice_user_id uuid REFERENCES public.backoffice_users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_worker_agenda_items_worker_starts
  ON public.worker_agenda_items (company_worker_id, starts_at);

COMMENT ON TABLE public.worker_agenda_items IS
  'Entradas de agenda del trabajador (propias o notas de admin). El calendario laboral (sede) define festivos y horarios; esta tabla es lo anotado en la agenda.';

CREATE TRIGGER tr_worker_agenda_items_updated_at
  BEFORE UPDATE ON public.worker_agenda_items
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.worker_agenda_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backoffice_authenticated_all_worker_agenda_items"
  ON public.worker_agenda_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Ampliar módulos permitidos (AGENDA opcional por trabajador).
ALTER TABLE public.backoffice_users
  DROP CONSTRAINT IF EXISTS backoffice_users_enabled_modules_valid;

ALTER TABLE public.backoffice_users
  ADD CONSTRAINT backoffice_users_enabled_modules_valid
  CHECK (enabled_modules <@ ARRAY['VACATIONS', 'MESSAGES', 'TIME_CLOCK', 'AGENDA']::text[]);

NOTIFY pgrst, 'reload schema';
