-- Evita errores "Could not find the table 'public.project_members' in the schema cache" (PostgREST):
-- la API HTTP sobre filas a veces no refresca; las funciones suelen resolverse correctamente.
-- Sustituye a .from("project_members") en la app.

CREATE OR REPLACE FUNCTION public.list_project_members_for_ids(p_project_ids uuid[])
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
  SELECT coalesce(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'project_id', m.project_id,
          'company_worker_id', m.company_worker_id,
          'role', m.role,
          'created_at', m.created_at
        ) ORDER BY m.project_id, m.created_at
      )
      FROM public.project_members m
      WHERE m.project_id = ANY (p_project_ids)
    ),
    '[]'::jsonb
  );
$fn$;

CREATE OR REPLACE FUNCTION public.sync_project_members(p_project_id uuid, p_members jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
BEGIN
  DELETE FROM public.project_members WHERE project_id = p_project_id;
  IF p_members IS NULL OR jsonb_typeof(p_members) <> 'array' OR jsonb_array_length(p_members) = 0 THEN
    RETURN;
  END IF;
  INSERT INTO public.project_members (project_id, company_worker_id, role)
  SELECT
    p_project_id,
    (e ->> 'company_worker_id')::uuid,
    (e ->> 'role')::public.project_member_role
  FROM jsonb_array_elements(p_members) AS e;
END;
$fn$;

REVOKE ALL ON FUNCTION public.list_project_members_for_ids(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_project_members(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_project_members_for_ids(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_project_members(uuid, jsonb) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
