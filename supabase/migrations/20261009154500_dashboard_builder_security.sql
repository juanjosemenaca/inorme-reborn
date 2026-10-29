-- Correcciones de seguridad del Dashboard Builder (incremental).
-- NO reescribe 20261009120000_dashboard_builder.sql.

-- ---------------------------------------------------------------------------
-- 1) Schedule: el widget debe ser del mismo usuario (RLS + trigger).
--    El trigger cubre también service role / dueño de tabla (RLS no aplica).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dashboard_schedule_widget_owned()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.widget_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.dashboard_widgets w
    WHERE w.id = NEW.widget_id
      AND w.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'dashboard_schedule_foreign_widget'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_dashboard_schedule_widget_owned ON public.dashboard_schedules;
CREATE TRIGGER tr_dashboard_schedule_widget_owned
  BEFORE INSERT OR UPDATE OF widget_id, user_id ON public.dashboard_schedules
  FOR EACH ROW EXECUTE PROCEDURE public.dashboard_schedule_widget_owned();

DROP POLICY IF EXISTS "dashboard_schedules_insert_own" ON public.dashboard_schedules;
CREATE POLICY "dashboard_schedules_insert_own"
  ON public.dashboard_schedules FOR INSERT TO authenticated
  WITH CHECK (
    user_id = public.ai_current_backoffice_user_id()
    AND (
      widget_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.dashboard_widgets w
        WHERE w.id = widget_id
          AND w.user_id = public.ai_current_backoffice_user_id()
      )
    )
  );

DROP POLICY IF EXISTS "dashboard_schedules_update_own" ON public.dashboard_schedules;
CREATE POLICY "dashboard_schedules_update_own"
  ON public.dashboard_schedules FOR UPDATE TO authenticated
  USING (user_id = public.ai_current_backoffice_user_id())
  WITH CHECK (
    user_id = public.ai_current_backoffice_user_id()
    AND (
      widget_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.dashboard_widgets w
        WHERE w.id = widget_id
          AND w.user_id = public.ai_current_backoffice_user_id()
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_dashboard_schedules_user_widget
  ON public.dashboard_schedules (user_id, widget_id);

-- ---------------------------------------------------------------------------
-- 2) Catálogo de fuentes, título, posición, tamaño de config.
--    Módulos: trigger (ADMIN tiene FACTURACION/GASTOS/maestros).
-- ---------------------------------------------------------------------------
ALTER TABLE public.dashboard_widgets
  DROP CONSTRAINT IF EXISTS dashboard_widgets_title_len_ck;
ALTER TABLE public.dashboard_widgets
  ADD CONSTRAINT dashboard_widgets_title_len_ck
  CHECK (char_length(title) <= 120);

ALTER TABLE public.dashboard_widgets
  DROP CONSTRAINT IF EXISTS dashboard_widgets_source_ck;
ALTER TABLE public.dashboard_widgets
  ADD CONSTRAINT dashboard_widgets_source_ck
  CHECK (
    (
      type = 'AI_REPORT'
      AND (
        (config->>'source') IS NULL
        OR (config->>'source') IN ('billing', 'expenses', 'projects', 'clients')
      )
    )
    OR (
      type <> 'AI_REPORT'
      AND (config->>'source') IN ('billing', 'expenses', 'projects', 'clients')
    )
  );

ALTER TABLE public.dashboard_widgets
  DROP CONSTRAINT IF EXISTS dashboard_widgets_position_ck;
ALTER TABLE public.dashboard_widgets
  ADD CONSTRAINT dashboard_widgets_position_ck
  CHECK (
    jsonb_typeof(position) = 'object'
    AND jsonb_typeof(position->'x') = 'number'
    AND jsonb_typeof(position->'y') = 'number'
    AND (position->>'x')::numeric >= 0 AND (position->>'x')::numeric <= 12
    AND (position->>'y')::numeric >= 0 AND (position->>'y')::numeric <= 200
  );

ALTER TABLE public.dashboard_widgets
  DROP CONSTRAINT IF EXISTS dashboard_widgets_config_size_ck;
ALTER TABLE public.dashboard_widgets
  ADD CONSTRAINT dashboard_widgets_config_size_ck
  CHECK (jsonb_typeof(config) = 'object' AND pg_column_size(config) <= 8192);

CREATE OR REPLACE FUNCTION public.dashboard_user_has_source(p_user_id uuid, p_source text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_source IS NULL OR btrim(p_source) = '' THEN true
    WHEN p_source NOT IN ('billing', 'expenses', 'projects', 'clients') THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.backoffice_users bu
      WHERE bu.id = p_user_id
        AND bu.active = true
        AND (
          CASE p_source
            WHEN 'billing' THEN
              bu.role = 'ADMIN' OR 'FACTURACION' = ANY (COALESCE(bu.enabled_modules, '{}'::text[]))
            WHEN 'expenses' THEN
              bu.role = 'ADMIN' OR 'GASTOS' = ANY (COALESCE(bu.enabled_modules, '{}'::text[]))
            WHEN 'projects' THEN
              bu.role = 'ADMIN' OR 'ADMIN_PROJECTS' = ANY (COALESCE(bu.enabled_modules, '{}'::text[]))
            WHEN 'clients' THEN
              bu.role = 'ADMIN' OR 'ADMIN_CLIENTS' = ANY (COALESCE(bu.enabled_modules, '{}'::text[]))
            ELSE false
          END
        )
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_user_has_source(uuid, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.dashboard_widget_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src text;
BEGIN
  src := NEW.config->>'source';
  IF NEW.type <> 'AI_REPORT' AND (src IS NULL OR src = '') THEN
    RAISE EXCEPTION 'dashboard_source_required' USING ERRCODE = '23514';
  END IF;
  IF src IS NOT NULL AND src <> '' AND src NOT IN ('billing', 'expenses', 'projects', 'clients') THEN
    RAISE EXCEPTION 'dashboard_unknown_source' USING ERRCODE = '23514';
  END IF;
  IF src IS NOT NULL AND src <> '' AND NOT public.dashboard_user_has_source(NEW.user_id, src) THEN
    RAISE EXCEPTION 'dashboard_source_forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_dashboard_widget_guard ON public.dashboard_widgets;
CREATE TRIGGER tr_dashboard_widget_guard
  BEFORE INSERT OR UPDATE OF type, config, user_id ON public.dashboard_widgets
  FOR EACH ROW EXECUTE PROCEDURE public.dashboard_widget_guard();

-- ---------------------------------------------------------------------------
-- 3) Caché de AI_REPORT (configuración ≠ resultado).
-- ---------------------------------------------------------------------------
ALTER TABLE public.dashboard_widgets
  ADD COLUMN IF NOT EXISTS report_content text;

ALTER TABLE public.dashboard_widgets
  ADD COLUMN IF NOT EXISTS report_status text NOT NULL DEFAULT 'idle';

ALTER TABLE public.dashboard_widgets
  ADD COLUMN IF NOT EXISTS report_generated_at timestamptz;

ALTER TABLE public.dashboard_widgets
  DROP CONSTRAINT IF EXISTS dashboard_widgets_report_status_ck;
ALTER TABLE public.dashboard_widgets
  ADD CONSTRAINT dashboard_widgets_report_status_ck
  CHECK (report_status IN ('idle', 'ready', 'error'));

ALTER TABLE public.dashboard_widgets
  DROP CONSTRAINT IF EXISTS dashboard_widgets_report_content_len_ck;
ALTER TABLE public.dashboard_widgets
  ADD CONSTRAINT dashboard_widgets_report_content_len_ck
  CHECK (report_content IS NULL OR char_length(report_content) <= 20000);

-- ---------------------------------------------------------------------------
-- 4) Aplicar layout / deshacer en una sola transacción (SECURITY INVOKER + RLS).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_own_dashboard_layout(p_replace boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  uid uuid := public.ai_current_backoffice_user_id();
  pending jsonb;
  item jsonb;
  created text[] := '{}';
  wtype text;
  wtitle text;
  wconfig jsonb;
  wpos jsonb;
  wwidth int;
  wheight int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT pending_layout INTO pending
  FROM public.dashboard_preferences
  WHERE user_id = uid;

  IF pending IS NULL OR jsonb_typeof(pending) IS DISTINCT FROM 'array' OR jsonb_array_length(pending) = 0 THEN
    RAISE EXCEPTION 'no_pending_layout' USING ERRCODE = 'P0002';
  END IF;

  IF p_replace THEN
    DELETE FROM public.dashboard_widgets WHERE user_id = uid;
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(pending)
  LOOP
    wtype := item->>'type';
    wtitle := left(btrim(COALESCE(item->>'title', 'Widget')), 120);
    wconfig := COALESCE(item->'config', '{}'::jsonb);
    wpos := COALESCE(item->'position', '{"x":0,"y":0}'::jsonb);
    wwidth := COALESCE((item->>'width')::int, 4);
    wheight := COALESCE((item->>'height')::int, 2);

    INSERT INTO public.dashboard_widgets (user_id, type, title, config, position, width, height, enabled)
    VALUES (uid, wtype, wtitle, wconfig, wpos, wwidth, wheight, true);

    created := array_append(created, wtitle);
  END LOOP;

  UPDATE public.dashboard_preferences
  SET pending_layout = NULL, updated_at = now()
  WHERE user_id = uid;

  RETURN jsonb_build_object('ok', true, 'created', created);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_own_dashboard_undo()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  uid uuid := public.ai_current_backoffice_user_id();
  snap jsonb;
  item jsonb;
  n int := 0;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT undo_snapshot INTO snap
  FROM public.dashboard_preferences
  WHERE user_id = uid;

  IF snap IS NULL OR jsonb_typeof(snap) IS DISTINCT FROM 'array' OR jsonb_array_length(snap) = 0 THEN
    RETURN 0;
  END IF;

  DELETE FROM public.dashboard_widgets WHERE user_id = uid;

  FOR item IN SELECT value FROM jsonb_array_elements(snap)
  LOOP
    INSERT INTO public.dashboard_widgets (user_id, type, title, config, position, width, height, enabled)
    VALUES (
      uid,
      item->>'type',
      left(btrim(COALESCE(item->>'title', 'Widget')), 120),
      COALESCE(item->'config', '{}'::jsonb),
      COALESCE(item->'position', '{"x":0,"y":0}'::jsonb),
      COALESCE((item->>'width')::int, 4),
      COALESCE((item->>'height')::int, 2),
      true
    );
    n := n + 1;
  END LOOP;

  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_own_dashboard_layout(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_own_dashboard_undo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_own_dashboard_layout(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_own_dashboard_undo() TO authenticated;

NOTIFY pgrst, 'reload schema';
