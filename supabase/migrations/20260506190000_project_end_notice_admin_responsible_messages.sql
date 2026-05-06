-- Avisos de fin de proyecto: mensaje en backoffice al responsable (si tiene usuario)
-- y a todos los usuarios ADMIN. Textos y payload diferenciados por destinatario.

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
  v_title text;
  v_body text;
  recipient record;
  v_code text;
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

    v_code := rec.id::text;

    FOR recipient IN
      SELECT
        bu.id AS user_id,
        bool_or(bu.role = 'ADMIN'::public.user_role) AS is_admin
      FROM public.backoffice_users bu
      WHERE bu.active = true
        AND (
          bu.company_worker_id IS NOT DISTINCT FROM rec.responsible_company_worker_id
          OR bu.role = 'ADMIN'::public.user_role
        )
      GROUP BY bu.id
    LOOP
      IF recipient.is_admin THEN
        v_title := 'Aviso administración: fin de proyecto próximo';
        v_body := format(
          E'Aviso automático para administradores: el proyecto «%s» (ref. %s) tiene fecha de fin prevista el %s.\n\nLa fecha de envío de este aviso es la configurada en el proyecto (o dos meses antes del fin si no hay fecha de aviso). El responsable del proyecto recibe el mismo aviso en su buzón del backoffice.',
          rec.title,
          v_code,
          to_char(rec.end_date, 'DD/MM/YYYY')
        );
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
          recipient.user_id,
          NULL,
          gen_random_uuid(),
          v_title,
          'PROJECT_END',
          v_title,
          v_body,
          jsonb_build_object(
            'type', 'project_end_notice',
            'audience', 'ADMIN',
            'projectId', rec.id,
            'endDate', rec.end_date,
            'noticeDate', notice_d
          )
        );
      ELSE
        v_title := 'Aviso: fin de proyecto próximo';
        v_body := format(
          E'Como responsable del proyecto «%s» (ref. %s), te recordamos que la fecha de fin prevista es el %s. Revisa cierre, entregas o una posible prórroga.\n\nLos administradores del backoffice reciben también este aviso.',
          rec.title,
          v_code,
          to_char(rec.end_date, 'DD/MM/YYYY')
        );
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
          recipient.user_id,
          NULL,
          gen_random_uuid(),
          v_title,
          'PROJECT_END',
          v_title,
          v_body,
          jsonb_build_object(
            'type', 'project_end_notice',
            'audience', 'PROJECT_RESPONSIBLE',
            'projectId', rec.id,
            'endDate', rec.end_date,
            'noticeDate', notice_d
          )
        );
      END IF;
      n := n + 1;
    END LOOP;

    UPDATE public.projects
    SET end_notice_message_sent_at = now(), updated_at = now()
    WHERE id = rec.id;
  END LOOP;

  RETURN n;
END;
$$;

COMMENT ON FUNCTION public.send_project_end_notices() IS
  'Una vez al día (Madrid): para proyectos cuya fecha de aviso es hoy, envía mensaje PROJECT_END al responsable (backoffice vinculado a su ficha) y a todos los ADMIN.';

REVOKE ALL ON FUNCTION public.send_project_end_notices() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_project_end_notices() TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_project_end_notices() TO service_role;

NOTIFY pgrst, 'reload schema';
