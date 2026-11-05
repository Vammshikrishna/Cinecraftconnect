-- PART FT (projects) - changing a team member's role (Project > Team): owner and admins, with rules, a log and a notification. Safe to run more than once.
--
-- THE ROLE MODEL (unchanged): project_space_members.role is text. 'admin' = may manage the team; any other text is the person's crew role ("member", "Cinematographer", ...).
-- The OWNER is the creator of the project space or of its project (not a row value). The owner's role can never be changed or removed.
--
-- WHAT THIS ADDS
--  1. Who may change a role: the owner, and members whose role is 'admin'. An admin can change crew roles and promote people to admin, but cannot change or remove another admin
--     (only the owner can). A normal member cannot change anything. Nobody can change the owner. A role must be 1 to 40 characters and cannot be "owner".
--  2. The same people may remove normal members (admins cannot remove admins; nobody removes the owner).
--  3. Every role change is logged in project_member_role_changes (who, whom, old, new, when; readable by the owner and the admins of that space).
--  4. The person whose role changed gets a notification ("Your role in <project> is now <role>"), so it also applies to them live.
-- The website only shows the controls these rules allow; this file makes the database refuse the rest, even from the API.
--
-- PREFLIGHT (read only): select policyname, cmd from pg_policies where tablename = 'project_space_members' order by 2, 1;
--   select to_regclass('public.project_member_role_changes');   -- null before
-- POST-CHECK (read only): select to_regclass('public.project_member_role_changes');  -> the table; select tgname from pg_trigger where tgrelid = 'public.project_space_members'::regclass and not tgisinternal;
--   -> cm_psm_role_guard and cm_psm_role_log are listed. Then change a member's role in Project > Team: they get a notification and a row appears in the log table.
-- ROLLBACK: drop trigger cm_psm_role_guard / cm_psm_role_log on public.project_space_members; drop policy cm_psm_admin_update / cm_psm_admin_delete on public.project_space_members.

SET lock_timeout = '5s';

-- helpers (row security off so they cannot recurse)
CREATE OR REPLACE FUNCTION public.cm_psm_is_owner(p_space uuid, p_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_spaces ps
    LEFT JOIN public.projects pr ON pr.id = ps.project_id
    WHERE ps.id = p_space AND (ps.creator_id = p_uid OR pr.creator_id = p_uid)
  );
$$;
CREATE OR REPLACE FUNCTION public.cm_psm_is_admin(p_space uuid, p_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
  SELECT EXISTS (SELECT 1 FROM public.project_space_members m WHERE m.project_space_id = p_space AND m.user_id = p_uid AND lower(COALESCE(m.role, '')) = 'admin');
$$;
REVOKE ALL ON FUNCTION public.cm_psm_is_owner(uuid, uuid), public.cm_psm_is_admin(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cm_psm_is_owner(uuid, uuid), public.cm_psm_is_admin(uuid, uuid) TO authenticated, service_role;

-- the log
CREATE TABLE IF NOT EXISTS public.project_member_role_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_space_id uuid NOT NULL,
  user_id uuid NOT NULL,
  old_role text,
  new_role text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_member_role_changes_space ON public.project_member_role_changes (project_space_id, changed_at DESC);
ALTER TABLE public.project_member_role_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cm_psm_role_log_read ON public.project_member_role_changes;
CREATE POLICY cm_psm_role_log_read ON public.project_member_role_changes FOR SELECT TO authenticated
  USING (public.cm_psm_is_owner(project_space_id, auth.uid()) OR public.cm_psm_is_admin(project_space_id, auth.uid()));
REVOKE INSERT, UPDATE, DELETE ON public.project_member_role_changes FROM anon, authenticated;

-- who may update / delete member rows (in addition to the owner policies that already exist)
DROP POLICY IF EXISTS cm_psm_admin_update ON public.project_space_members;
CREATE POLICY cm_psm_admin_update ON public.project_space_members FOR UPDATE TO authenticated
  USING (public.cm_psm_is_owner(project_space_id, auth.uid()) OR public.cm_psm_is_admin(project_space_id, auth.uid()))
  WITH CHECK (public.cm_psm_is_owner(project_space_id, auth.uid()) OR public.cm_psm_is_admin(project_space_id, auth.uid()));

DROP POLICY IF EXISTS cm_psm_admin_delete ON public.project_space_members;
CREATE POLICY cm_psm_admin_delete ON public.project_space_members FOR DELETE TO authenticated
  USING (
    NOT public.cm_psm_is_owner(project_space_id, user_id)
    AND (public.cm_psm_is_owner(project_space_id, auth.uid())
         OR (public.cm_psm_is_admin(project_space_id, auth.uid()) AND lower(COALESCE(role, '')) <> 'admin'))
  );

-- the rules for a role change
CREATE OR REPLACE FUNCTION public.cm_psm_role_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_new text;
  v_caller_owner boolean;
BEGIN
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN RETURN NEW; END IF;
  IF v_caller IS NULL THEN RETURN NEW; END IF;                       -- server / service role
  v_caller_owner := public.cm_psm_is_owner(NEW.project_space_id, v_caller);
  v_new := btrim(COALESCE(NEW.role, ''));
  IF v_new = '' OR length(v_new) > 40 THEN
    RAISE EXCEPTION 'A role must be 1 to 40 characters.' USING ERRCODE = 'P0001';
  END IF;
  IF lower(v_new) = 'owner' THEN
    RAISE EXCEPTION 'The owner role cannot be given to anyone.' USING ERRCODE = 'P0001';
  END IF;
  IF public.cm_psm_is_owner(NEW.project_space_id, NEW.user_id) THEN
    RAISE EXCEPTION 'The owner''s role cannot be changed.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (v_caller_owner OR public.cm_psm_is_admin(NEW.project_space_id, v_caller)) THEN
    RAISE EXCEPTION 'Only the owner or an admin can change roles.' USING ERRCODE = 'P0001';
  END IF;
  IF lower(COALESCE(OLD.role, '')) = 'admin' AND NOT v_caller_owner AND NEW.user_id <> v_caller THEN
    RAISE EXCEPTION 'Only the owner can change an admin''s role.' USING ERRCODE = 'P0001';
  END IF;
  NEW.role := CASE WHEN lower(v_new) = 'admin' THEN 'admin' WHEN lower(v_new) = 'member' THEN 'member' ELSE v_new END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.cm_psm_role_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS cm_psm_role_guard ON public.project_space_members;
CREATE TRIGGER cm_psm_role_guard BEFORE UPDATE OF role ON public.project_space_members
  FOR EACH ROW EXECUTE FUNCTION public.cm_psm_role_guard();

-- the log and the notification
CREATE OR REPLACE FUNCTION public.cm_psm_role_log() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE
  v_project_id uuid;
  v_name text;
BEGIN
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN RETURN NEW; END IF;
  INSERT INTO public.project_member_role_changes (project_space_id, user_id, old_role, new_role, changed_by)
  VALUES (NEW.project_space_id, NEW.user_id, OLD.role, NEW.role, auth.uid());
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    SELECT ps.project_id, COALESCE(pr.title, ps.name) INTO v_project_id, v_name
    FROM public.project_spaces ps LEFT JOIN public.projects pr ON pr.id = ps.project_id WHERE ps.id = NEW.project_space_id;
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id)
    VALUES (NEW.user_id, auth.uid(), 'project_update', 'Your role changed',
            'Your role in ' || COALESCE(v_name, 'the project') || ' is now ' || CASE WHEN lower(COALESCE(NEW.role, '')) = 'admin' THEN 'Admin' ELSE COALESCE(NEW.role, 'Member') END || '.',
            '/projects/' || COALESCE(v_project_id::text, '') || '/space', NEW.project_space_id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.cm_psm_role_log() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS cm_psm_role_log ON public.project_space_members;
CREATE TRIGGER cm_psm_role_log AFTER UPDATE OF role ON public.project_space_members
  FOR EACH ROW EXECUTE FUNCTION public.cm_psm_role_log();

NOTIFY pgrst, 'reload schema';
