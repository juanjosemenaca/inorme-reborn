-- Buzon interno de mensajes para usuarios del backoffice.

CREATE TABLE public.backoffice_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_backoffice_user_id uuid NOT NULL REFERENCES public.backoffice_users (id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'GENERAL',
  title text NOT NULL,
  body text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_backoffice_messages_recipient_created
  ON public.backoffice_messages (recipient_backoffice_user_id, created_at DESC);

CREATE INDEX idx_backoffice_messages_recipient_unread
  ON public.backoffice_messages (recipient_backoffice_user_id, created_at DESC)
  WHERE read_at IS NULL;

COMMENT ON TABLE public.backoffice_messages IS
  'Buzon de mensajes interno para notificaciones de distintos flujos (vacaciones, perfil, etc.).';

ALTER TABLE public.backoffice_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backoffice_authenticated_all_backoffice_messages"
  ON public.backoffice_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.backoffice_messages TO authenticated;

NOTIFY pgrst, 'reload schema';
