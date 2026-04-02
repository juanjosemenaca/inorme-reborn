-- Conversaciones en el buzón backoffice (admin <-> trabajador) manteniendo compatibilidad
-- con mensajes existentes de sistema.

ALTER TABLE public.backoffice_messages
  ADD COLUMN IF NOT EXISTS sender_backoffice_user_id uuid REFERENCES public.backoffice_users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS thread_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS thread_title text;

CREATE INDEX IF NOT EXISTS idx_backoffice_messages_thread_created
  ON public.backoffice_messages (thread_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_backoffice_messages_sender_created
  ON public.backoffice_messages (sender_backoffice_user_id, created_at DESC);

COMMENT ON COLUMN public.backoffice_messages.sender_backoffice_user_id IS
  'Perfil backoffice que envía el mensaje. Null para mensajes legacy/sistema.';
COMMENT ON COLUMN public.backoffice_messages.thread_id IS
  'Identificador de conversación (hilo) para enlazar respuestas.';
COMMENT ON COLUMN public.backoffice_messages.thread_title IS
  'Asunto del hilo para mostrar en listados.';
