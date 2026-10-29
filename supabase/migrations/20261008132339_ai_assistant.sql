-- Asistente IA de Inorme: conversaciones, mensajes y auditoría.
-- Solo crea objetos nuevos; no modifica tablas, políticas ni funciones existentes.
-- Idempotente: puede ejecutarse más de una vez sin error.
-- Ver docs/AI_ASSISTANT_ARCHITECTURE.md.

-- ---------------------------------------------------------------------------
-- Usuario backoffice actual (activo) a partir de auth.uid()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ai_current_backoffice_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bu.id
  FROM public.backoffice_users bu
  WHERE bu.auth_user_id = auth.uid()
    AND bu.active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.ai_current_backoffice_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ai_current_backoffice_user_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- Conversaciones
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.backoffice_users (id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_updated
  ON public.ai_conversations (user_id, updated_at DESC);

COMMENT ON TABLE public.ai_conversations IS
  'Conversaciones del Asistente IA. Privadas: cada usuario solo accede a las suyas.';

DROP TRIGGER IF EXISTS tr_ai_conversations_updated_at ON public.ai_conversations;
CREATE TRIGGER tr_ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_conversations_select_own" ON public.ai_conversations;
CREATE POLICY "ai_conversations_select_own"
  ON public.ai_conversations FOR SELECT TO authenticated
  USING (user_id = public.ai_current_backoffice_user_id());

DROP POLICY IF EXISTS "ai_conversations_insert_own" ON public.ai_conversations;
CREATE POLICY "ai_conversations_insert_own"
  ON public.ai_conversations FOR INSERT TO authenticated
  WITH CHECK (user_id = public.ai_current_backoffice_user_id());

DROP POLICY IF EXISTS "ai_conversations_update_own" ON public.ai_conversations;
CREATE POLICY "ai_conversations_update_own"
  ON public.ai_conversations FOR UPDATE TO authenticated
  USING (user_id = public.ai_current_backoffice_user_id())
  WITH CHECK (user_id = public.ai_current_backoffice_user_id());

DROP POLICY IF EXISTS "ai_conversations_delete_own" ON public.ai_conversations;
CREATE POLICY "ai_conversations_delete_own"
  ON public.ai_conversations FOR DELETE TO authenticated
  USING (user_id = public.ai_current_backoffice_user_id());

-- ---------------------------------------------------------------------------
-- Mensajes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations (id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL DEFAULT '',
  -- Informe estructurado (AiReport), herramientas usadas, etc. Nunca secretos.
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_messages_role_ck CHECK (role IN ('user', 'assistant'))
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_created
  ON public.ai_messages (conversation_id, created_at);

COMMENT ON TABLE public.ai_messages IS
  'Mensajes de una conversación del Asistente IA (usuario / asistente).';

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_messages_select_own" ON public.ai_messages;
CREATE POLICY "ai_messages_select_own"
  ON public.ai_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_conversations c
      WHERE c.id = ai_messages.conversation_id
        AND c.user_id = public.ai_current_backoffice_user_id()
    )
  );

DROP POLICY IF EXISTS "ai_messages_insert_own" ON public.ai_messages;
CREATE POLICY "ai_messages_insert_own"
  ON public.ai_messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_conversations c
      WHERE c.id = ai_messages.conversation_id
        AND c.user_id = public.ai_current_backoffice_user_id()
    )
  );

-- Sin políticas de UPDATE/DELETE: los mensajes son inmutables para el usuario;
-- se eliminan en cascada al borrar la conversación.

-- ---------------------------------------------------------------------------
-- Auditoría (solo service_role; la Edge Function escribe y lee)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backoffice_user_id uuid REFERENCES public.backoffice_users (id) ON DELETE SET NULL,
  conversation_id uuid,
  action text NOT NULL,
  tool_name text,
  status text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_audit_logs_status_ck CHECK (status IN ('ok', 'error', 'denied'))
);

CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_user_created
  ON public.ai_audit_logs (backoffice_user_id, created_at DESC);

COMMENT ON TABLE public.ai_audit_logs IS
  'Auditoría del Asistente IA: peticiones, herramientas, denegaciones y errores. Sin secretos ni resultados.';

ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;
-- Sin políticas: ningún rol JWT (anon/authenticated) puede leer ni escribir.
REVOKE ALL ON TABLE public.ai_audit_logs FROM anon, authenticated;

-- Privilegios mínimos (Supabase concede ALL por defecto a anon/authenticated en tablas nuevas).
REVOKE ALL ON TABLE public.ai_conversations FROM anon, authenticated;
REVOKE ALL ON TABLE public.ai_messages FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_conversations TO authenticated;
GRANT SELECT, INSERT ON TABLE public.ai_messages TO authenticated;

NOTIFY pgrst, 'reload schema';
