-- PART CW - let space owners remove members, and let members leave (fix for "removing a member does nothing")
-- project_space_members had NO delete rule, so every delete was refused for everyone.
-- (An earlier version of this file used a helper that signed-in users may not call; that gave "403 Forbidden". This version
--  checks the owner directly, and also fixes the same kind of problem for the new key-rotation tables from part CV.)
--   * the project space's creator / the project's creator can remove other members
--   * anyone can remove themselves (leave)
--   * the owner cannot be removed by someone else
-- Run after part CV. Safe to run more than once.

DROP POLICY IF EXISTS "Owners remove members; members can leave" ON public.project_space_members;
CREATE POLICY "Owners remove members; members can leave" ON public.project_space_members
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      EXISTS (
        SELECT 1 FROM public.project_spaces ps
        LEFT JOIN public.projects pr ON pr.id = ps.project_id
        WHERE ps.id = project_space_members.project_space_id
          AND (ps.creator_id = auth.uid() OR pr.creator_id = auth.uid())
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.project_spaces ps
        LEFT JOIN public.projects pr ON pr.id = ps.project_id
        WHERE ps.id = project_space_members.project_space_id
          AND (ps.creator_id = project_space_members.user_id OR pr.creator_id = project_space_members.user_id)
      )
    )
  );

-- Part CV's read rules on group_key_state call cv_can_see_group; signed-in people must be allowed to run it
-- (it only answers "is this person in this chat", which members lists already show).
GRANT EXECUTE ON FUNCTION public.cv_can_see_group(text, uuid, uuid) TO authenticated;

-- When someone is removed, their old join request must not stay "approved" (the app showed "Your request has been approved,
-- refresh the page" to a person who had just been removed). Delete it so they can ask to join again.
CREATE OR REPLACE FUNCTION public.cw_reset_join_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  DELETE FROM public.project_space_join_requests WHERE project_space_id = OLD.project_space_id AND user_id = OLD.user_id;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS cw_reset_join_request ON public.project_space_members;
CREATE TRIGGER cw_reset_join_request
  AFTER DELETE ON public.project_space_members
  FOR EACH ROW EXECUTE FUNCTION public.cw_reset_join_request();

-- Clean up people who were already removed and still carry an approved request (they have no membership row):
DELETE FROM public.project_space_join_requests r
 WHERE r.status = 'approved'
   AND NOT EXISTS (SELECT 1 FROM public.project_space_members m WHERE m.project_space_id = r.project_space_id AND m.user_id = r.user_id);
