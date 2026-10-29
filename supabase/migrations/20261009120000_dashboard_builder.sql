-- Dashboard personal configurable (widgets + preferencias + schedules).
-- Solo objetos nuevos. RLS: cada usuario solo ve lo suyo.
-- Helper reutilizado: public.ai_current_backoffice_user_id()

CREATE TABLE IF NOT EXISTS public.dashboard_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.backoffice_users (id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL DEFAULT '',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  position jsonb NOT NULL DEFAULT '{"x":0,"y":0}'::jsonb,
  width integer NOT NULL DEFAULT 4,
  height integer NOT NULL DEFAULT 2,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dashboard_widgets_type_ck CHECK (
    type IN (
      'KPI',
      'KPI_VARIATION',
      'LINE_CHART',
      'BAR_CHART',
      'PIE_CHART',
      'TABLE',
      'RANKING',
      'ALERT',
      'AI_REPORT'
    )
  ),
  CONSTRAINT dashboard_widgets_width_ck CHECK (width >= 1 AND width <= 12),
  CONSTRAINT dashboard_widgets_height_ck CHECK (height >= 1 AND height <= 8)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_user
  ON public.dashboard_widgets (user_id, enabled, created_at);

COMMENT ON TABLE public.dashboard_widgets IS
  'Widgets del panel personal. Privados: cada backoffice_user solo accede a los suyos.';

DROP TRIGGER IF EXISTS tr_dashboard_widgets_updated_at ON public.dashboard_widgets;
CREATE TRIGGER tr_dashboard_widgets_updated_at
  BEFORE UPDATE ON public.dashboard_widgets
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dashboard_widgets_select_own" ON public.dashboard_widgets;
CREATE POLICY "dashboard_widgets_select_own"
  ON public.dashboard_widgets FOR SELECT TO authenticated
  USING (user_id = public.ai_current_backoffice_user_id());

DROP POLICY IF EXISTS "dashboard_widgets_insert_own" ON public.dashboard_widgets;
CREATE POLICY "dashboard_widgets_insert_own"
  ON public.dashboard_widgets FOR INSERT TO authenticated
  WITH CHECK (user_id = public.ai_current_backoffice_user_id());

DROP POLICY IF EXISTS "dashboard_widgets_update_own" ON public.dashboard_widgets;
CREATE POLICY "dashboard_widgets_update_own"
  ON public.dashboard_widgets FOR UPDATE TO authenticated
  USING (user_id = public.ai_current_backoffice_user_id())
  WITH CHECK (user_id = public.ai_current_backoffice_user_id());

DROP POLICY IF EXISTS "dashboard_widgets_delete_own" ON public.dashboard_widgets;
CREATE POLICY "dashboard_widgets_delete_own"
  ON public.dashboard_widgets FOR DELETE TO authenticated
  USING (user_id = public.ai_current_backoffice_user_id());

-- Preferencias (snapshot para Deshacer)
CREATE TABLE IF NOT EXISTS public.dashboard_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.backoffice_users (id) ON DELETE CASCADE,
  undo_snapshot jsonb,
  pending_layout jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.dashboard_preferences IS
  'Preferencias del panel personal, incluido snapshot para deshacer cambios de IA.';

ALTER TABLE public.dashboard_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dashboard_preferences_select_own" ON public.dashboard_preferences;
CREATE POLICY "dashboard_preferences_select_own"
  ON public.dashboard_preferences FOR SELECT TO authenticated
  USING (user_id = public.ai_current_backoffice_user_id());

DROP POLICY IF EXISTS "dashboard_preferences_insert_own" ON public.dashboard_preferences;
CREATE POLICY "dashboard_preferences_insert_own"
  ON public.dashboard_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = public.ai_current_backoffice_user_id());

DROP POLICY IF EXISTS "dashboard_preferences_update_own" ON public.dashboard_preferences;
CREATE POLICY "dashboard_preferences_update_own"
  ON public.dashboard_preferences FOR UPDATE TO authenticated
  USING (user_id = public.ai_current_backoffice_user_id())
  WITH CHECK (user_id = public.ai_current_backoffice_user_id());

-- Infraestructura de programación (sin worker/cron todavía)
CREATE TABLE IF NOT EXISTS public.dashboard_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.backoffice_users (id) ON DELETE CASCADE,
  widget_id uuid REFERENCES public.dashboard_widgets (id) ON DELETE CASCADE,
  frequency text NOT NULL,
  hour integer NOT NULL DEFAULT 8,
  weekday integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dashboard_schedules_frequency_ck CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  CONSTRAINT dashboard_schedules_hour_ck CHECK (hour >= 0 AND hour <= 23),
  CONSTRAINT dashboard_schedules_weekday_ck CHECK (weekday IS NULL OR (weekday >= 1 AND weekday <= 7))
);

COMMENT ON TABLE public.dashboard_schedules IS
  'Programación futura de widgets (p. ej. AI_REPORT semanal). Sin ejecutor todavía.';

DROP TRIGGER IF EXISTS tr_dashboard_schedules_updated_at ON public.dashboard_schedules;
CREATE TRIGGER tr_dashboard_schedules_updated_at
  BEFORE UPDATE ON public.dashboard_schedules
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.dashboard_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dashboard_schedules_select_own" ON public.dashboard_schedules;
CREATE POLICY "dashboard_schedules_select_own"
  ON public.dashboard_schedules FOR SELECT TO authenticated
  USING (user_id = public.ai_current_backoffice_user_id());

DROP POLICY IF EXISTS "dashboard_schedules_insert_own" ON public.dashboard_schedules;
CREATE POLICY "dashboard_schedules_insert_own"
  ON public.dashboard_schedules FOR INSERT TO authenticated
  WITH CHECK (user_id = public.ai_current_backoffice_user_id());

DROP POLICY IF EXISTS "dashboard_schedules_update_own" ON public.dashboard_schedules;
CREATE POLICY "dashboard_schedules_update_own"
  ON public.dashboard_schedules FOR UPDATE TO authenticated
  USING (user_id = public.ai_current_backoffice_user_id())
  WITH CHECK (user_id = public.ai_current_backoffice_user_id());

DROP POLICY IF EXISTS "dashboard_schedules_delete_own" ON public.dashboard_schedules;
CREATE POLICY "dashboard_schedules_delete_own"
  ON public.dashboard_schedules FOR DELETE TO authenticated
  USING (user_id = public.ai_current_backoffice_user_id());

REVOKE ALL ON TABLE public.dashboard_widgets FROM anon, authenticated;
REVOKE ALL ON TABLE public.dashboard_preferences FROM anon, authenticated;
REVOKE ALL ON TABLE public.dashboard_schedules FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dashboard_widgets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.dashboard_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dashboard_schedules TO authenticated;

NOTIFY pgrst, 'reload schema';
