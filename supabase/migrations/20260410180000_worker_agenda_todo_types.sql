-- Tipos de agenda ampliados (comentario, nota, to-do) y seguimiento de to-dos completados por el trabajador.

ALTER TABLE public.worker_agenda_items
  DROP CONSTRAINT IF EXISTS worker_agenda_items_item_type_check;

ALTER TABLE public.worker_agenda_items
  ADD CONSTRAINT worker_agenda_items_item_type_check CHECK (
    item_type IN (
      'reminder',
      'event',
      'meeting',
      'other',
      'admin_note',
      'comment',
      'note',
      'todo'
    )
  );

ALTER TABLE public.worker_agenda_items
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by_backoffice_user_id uuid REFERENCES public.backoffice_users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.worker_agenda_items.completed_at IS
  'Si item_type = todo y fue creado por admin: fecha en que el trabajador lo marcó como hecho.';
COMMENT ON COLUMN public.worker_agenda_items.completed_by_backoffice_user_id IS
  'Usuario backoffice del trabajador que marcó el to-do como completado.';

NOTIFY pgrst, 'reload schema';
