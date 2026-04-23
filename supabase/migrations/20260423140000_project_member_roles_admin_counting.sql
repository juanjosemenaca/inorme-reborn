-- Nuevos roles de miembro de proyecto: administración, contabilidad y control de gestión.
ALTER TYPE public.project_member_role ADD VALUE IF NOT EXISTS 'ADMINISTRATIVA';
ALTER TYPE public.project_member_role ADD VALUE IF NOT EXISTS 'CONTABLE';
ALTER TYPE public.project_member_role ADD VALUE IF NOT EXISTS 'CONTROLER';

NOTIFY pgrst, 'reload schema';
