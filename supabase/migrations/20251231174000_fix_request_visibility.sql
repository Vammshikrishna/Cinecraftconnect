-- ============================================================================
-- FIX MISSING SELECT POLICY FOR JOIN REQUESTS
-- ============================================================================
-- Users could CREATE requests but not SEE their own requests status.
-- This caused the frontend to think no request existed, prompting "Request to Join" again,
-- which then failed with a Duplicate error.

DROP POLICY IF EXISTS "Users can view their own requests" ON public.project_space_join_requests;

CREATE POLICY "Users can view their own requests" ON public.project_space_join_requests
FOR SELECT USING (
  user_id = auth.uid()
);

-- Also ensure Creators can see them (was likely already covered, but reinforcing)
DROP POLICY IF EXISTS "Creators can view requests" ON public.project_space_join_requests;

CREATE POLICY "Creators can view requests" ON public.project_space_join_requests
FOR SELECT USING (
  public.check_is_project_creator(project_space_id)
);
