-- PART EE - let the project space creator change a member's role. Safe to run more than once. Run after parts CL and CW.
-- project_space_members had no UPDATE rule, so changing a member's role (the "role" editor on the Team tab, web and mobile)
-- was refused for everybody, creator included. This adds one:
--   * only the space's creator or the parent project's creator can update a member row (same rule as cj_can_manage_space,
--     written out directly so signed-in users do not need to be allowed to call that helper, as in part CW);
--   * only the role can change: the person and the space on a row can never be changed;
--   * the role must be a short plain text (1 to 40 characters, no control characters);
--   * the creator's own row cannot be edited by anybody else.
--
-- PREFLIGHT (read only: run first, they change nothing)
--   -- a) the table has no UPDATE policy yet (expect 0 rows before this part, 1 row after)
--   select policyname, cmd from pg_policies where tablename = 'project_space_members' and cmd = 'UPDATE';
--   -- b) the roles currently in use (so the 40 character limit does not surprise anybody)
--   select role, count(*) from public.project_space_members group by 1 order by 2 desc;
--   -- c) any role longer than 40 characters or with control characters (expect 0 rows)
--   select project_space_id, user_id, role from public.project_space_members where char_length(role) > 40 or role ~ '[[:cntrl:]]';

BEGIN;

DROP POLICY IF EXISTS "Owners change member roles" ON public.project_space_members;
CREATE POLICY "Owners change member roles" ON public.project_space_members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_spaces ps
      LEFT JOIN public.projects pr ON pr.id = ps.project_id
      WHERE ps.id = project_space_members.project_space_id
        AND (ps.creator_id = auth.uid() OR pr.creator_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_spaces ps
      LEFT JOIN public.projects pr ON pr.id = ps.project_id
      WHERE ps.id = project_space_members.project_space_id
        AND (ps.creator_id = auth.uid() OR pr.creator_id = auth.uid())
    )
  );

-- Column rules: only "role" may change, and it must be a sane value. The creator's own row is left alone.
CREATE OR REPLACE FUNCTION public.ee_guard_space_member_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  -- server-side code (service role / SQL editor) is not restricted
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.project_space_id IS DISTINCT FROM OLD.project_space_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only the role of a member can be changed' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.role IS NOT NULL AND (char_length(btrim(NEW.role)) < 1 OR char_length(NEW.role) > 40 OR NEW.role ~ '[[:cntrl:]]') THEN
    RAISE EXCEPTION 'A role must be 1 to 40 characters of plain text' USING ERRCODE = 'P0001';
  END IF;

  -- nobody can edit the creator's own row (the creator is the creator, whatever role label the team list shows)
  IF EXISTS (
    SELECT 1 FROM public.project_spaces ps
    LEFT JOIN public.projects pr ON pr.id = ps.project_id
    WHERE ps.id = OLD.project_space_id
      AND (ps.creator_id = OLD.user_id OR pr.creator_id = OLD.user_id)
  ) AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'The space creator''s role cannot be changed' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.ee_guard_space_member_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ee_guard_space_member_update ON public.project_space_members;
CREATE TRIGGER ee_guard_space_member_update BEFORE UPDATE ON public.project_space_members
  FOR EACH ROW EXECUTE FUNCTION public.ee_guard_space_member_update();

COMMIT;

-- POST-CHECK (read only)
--   -- the policy and the trigger exist (expect 1 and 1)
--   select count(*) from pg_policies where tablename = 'project_space_members' and policyname = 'Owners change member roles';
--   select count(*) from pg_trigger where tgrelid = 'public.project_space_members'::regclass and tgname = 'ee_guard_space_member_update' and not tgisinternal;
--   -- smoke test as the space creator: update public.project_space_members set role = 'Director' where project_space_id = '<space>' and user_id = '<a member>';  (works)
--   -- as an ordinary member the same update changes 0 rows (refused); changing user_id on a row is refused for everybody.
