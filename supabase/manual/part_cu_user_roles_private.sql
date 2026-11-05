-- PART CU - user_roles is no longer readable by everyone (audit step 6)
-- Run in the Supabase SQL editor BEFORE shipping the new web build is NOT required: the old build keeps working for
-- everything except hiding staff in member lists (it will then just show no staff badges). Best order: run this, then ship web.
--
-- Before: anyone, even signed out, could read the full list of who is a moderator / admin / super admin.
-- After:  a person reads only their own role; super admins can read all; other screens that need to know "which of these
--         people are staff" (to hide staff from member lists) use staff_roles_for(), which answers only for the ids asked
--         about, only for signed-in people, and only for staff roles.
-- Nobody can write this table from the app (writes already had no policy; the grants are removed too).

DROP POLICY IF EXISTS "Anyone can view internal roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can view all roles" ON public.user_roles;

CREATE POLICY "Super admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role('super_admin'::public.app_role, auth.uid()));

-- "Users can view own role" stays as it is.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.user_roles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.user_roles FROM anon;

CREATE OR REPLACE FUNCTION public.staff_roles_for(p_ids uuid[])
 RETURNS TABLE(user_id uuid, role text)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT ur.user_id, ur.role::text
    FROM public.user_roles ur
   WHERE auth.uid() IS NOT NULL
     AND ur.user_id = ANY (p_ids[1:200])
     AND ur.role::text IN ('moderator', 'admin', 'super_admin');
$function$;

REVOKE ALL ON FUNCTION public.staff_roles_for(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_roles_for(uuid[]) TO authenticated, service_role;
