-- PART FM (invites) - invite links cannot be created: POST /rest/v1/project_invites returns 403 "permission denied for function cj_can_manage_space". Safe to run more than once.
--
-- WHAT WENT WRONG: the invite policies from part FH call public.cj_can_manage_space(project_id, auth.uid()). Part CJ closed that function to signed-in people (REVOKE ... FROM authenticated),
-- because it takes any user id. A policy runs as the caller, so every invite insert / select / delete is refused. (Team > Invite Link shows "Failed to generate invite link".)
-- THE FIX: use public.cl_i_manage_space(project_id) instead: it only ever answers for the signed-in person and is already granted to signed-in users (part CL).
--
-- PREFLIGHT (read only): select policyname, qual, with_check from pg_policies where tablename = 'project_invites';   -- they mention cj_can_manage_space
-- POST-CHECK (read only): the same query mentions cl_i_manage_space; then Team > Invite Link produces a link and opening it as a creator or studio account joins the project.

DROP POLICY IF EXISTS "Project members can view invites" ON public.project_invites;
CREATE POLICY "Project members can view invites" ON public.project_invites FOR SELECT
  USING (public.cl_i_manage_space(project_id)
         OR EXISTS (SELECT 1 FROM public.project_space_members m WHERE m.project_space_id = project_invites.project_id AND m.user_id = auth.uid()));

DROP POLICY IF EXISTS "Project creators can create invites" ON public.project_invites;
CREATE POLICY "Project creators can create invites" ON public.project_invites FOR INSERT
  WITH CHECK (created_by = auth.uid() AND public.cl_i_manage_space(project_id));

DROP POLICY IF EXISTS "Project creators can delete invites" ON public.project_invites;
CREATE POLICY "Project creators can delete invites" ON public.project_invites FOR DELETE
  USING (public.cl_i_manage_space(project_id));
