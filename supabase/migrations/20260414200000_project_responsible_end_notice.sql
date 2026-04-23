-- Proyecto: responsable (ficha trabajador); fechas inicio/fin; aviso por mensaje en la fecha de aviso (por defecto 2 meses antes del fin).

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS responsible_company_worker_id uuid REFERENCES public.company_workers (id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS end_notice_at date,
  ADD COLUMN IF NOT EXISTS end_notice_message_sent_at timestamptz;

COMMENT ON COLUMN public.projects.responsible_company_worker_id IS
  'Responsable del proyecto. Avisos de fin a responsable (si tiene usuario) y administradores.';

COMMENT ON COLUMN public.projects.end_notice_at IS
  'Día en que se envía el aviso. Si null, se usa (end_date - 2 meses).';

COMMENT ON COLUMN public.projects.end_notice_message_sent_at IS
  'Cuando ya se envió el aviso; se anula al cambiar fechas, responsable o aviso (desde app).';

CREATE INDEX IF NOT EXISTS idx_projects_responsible ON public.projects (responsible_company_worker_id);

-- Fechas: rellenar nulos y pasar a NOT NULL
UPDATE public.projects
SET start_date = COALESCE(
    start_date,
    (created_at AT TIME ZONE 'UTC')::date
  )
WHERE start_date IS NULL;

UPDATE public.projects
SET end_date = COALESCE(end_date, start_date + 365)
WHERE end_date IS NULL;

-- Corregir pares inválidos (por si acaso)
UPDATE public.projects
SET end_date = start_date
WHERE end_date < start_date;

ALTER TABLE public.projects
  ALTER COLUMN start_date SET NOT NULL,
  ALTER COLUMN end_date SET NOT NULL;

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_end_after_start;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_end_after_start
  CHECK (end_date >= start_date);

-- Responsable: miembro de equipo, o primer trabajador activo
UPDATE public.projects p
SET responsible_company_worker_id = m.company_worker_id
FROM (
  SELECT DISTINCT ON (project_id) project_id, company_worker_id
  FROM public.project_members
  ORDER BY project_id, created_at
) m
WHERE p.id = m.project_id
  AND p.responsible_company_worker_id IS NULL;

UPDATE public.projects
SET responsible_company_worker_id = (
  SELECT id FROM public.company_workers WHERE active = true ORDER BY created_at LIMIT 1
)
WHERE responsible_company_worker_id IS NULL
  AND EXISTS (SELECT 1 FROM public.company_workers WHERE active = true);

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_end_notice_before_end;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_end_notice_before_end
  CHECK (end_notice_at IS NULL OR end_notice_at <= end_date);

-- Aviso en calendario Europa/Madrid
CREATE OR REPLACE FUNCTION public.send_project_end_notices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int := 0;
  rec record;
  notice_d date;
  today_madrid date;
  v_title text := 'Aviso: fin de proyecto próximo';
  v_body text;
  r_id uuid;
BEGIN
  today_madrid := (now() AT TIME ZONE 'Europe/Madrid')::date;

  FOR rec IN
    SELECT p.*
    FROM public.projects p
    WHERE p.end_notice_message_sent_at IS NULL
      AND p.responsible_company_worker_id IS NOT NULL
  LOOP
    notice_d := COALESCE(rec.end_notice_at, (rec.end_date - interval '2 months')::date);
    IF notice_d <> today_madrid THEN
      CONTINUE;
    END IF;

    v_body := format(
      'Aviso automático: el proyecto «%s» tiene prevista su fecha de fin el %s. Revisa cierre, entregas o una posible prórroga (este aviso se programa con dos meses de antelación respecto a la fecha de fin, o la «fecha de aviso» personalizada).',
      rec.title,
      to_char(rec.end_date, 'DD/MM/YYYY')
    );

    FOR r_id IN
      SELECT DISTINCT bu.id
      FROM public.backoffice_users bu
      WHERE bu.active = true
        AND (
          bu.company_worker_id = rec.responsible_company_worker_id
          OR bu.role = 'ADMIN'::public.user_role
        )
    LOOP
      INSERT INTO public.backoffice_messages (
        recipient_backoffice_user_id,
        sender_backoffice_user_id,
        thread_id,
        thread_title,
        category,
        title,
        body,
        payload
      ) VALUES (
        r_id,
        NULL,
        gen_random_uuid(),
        v_title,
        'PROJECT_END',
        v_title,
        v_body,
        jsonb_build_object('type', 'project_end_notice', 'projectId', rec.id, 'endDate', rec.end_date)
      );
      n := n + 1;
    END LOOP;

    UPDATE public.projects
    SET end_notice_message_sent_at = now(), updated_at = now()
    WHERE id = rec.id;
  END LOOP;

  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.send_project_end_notices() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_project_end_notices() TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_project_end_notices() TO service_role;

NOTIFY pgrst, 'reload schema';
