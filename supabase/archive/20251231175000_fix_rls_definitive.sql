-- ============================================================================
-- FIX RLS VISIBILITY DEFINITIVELY
-- ============================================================================

-- 1. JOIN REQUESTS: Allow users to see their own requests (ALL statuses)
DROP POLICY IF EXISTS "Users can view their own requests" ON public.project_space_join_requests;
DROP POLICY IF EXISTS "view_own_requests" ON public.project_space_join_requests;

CREATE POLICY "view_own_requests" ON public.project_space_join_requests
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
);

-- 2. MEMBERS: Allow users to see their own membership (ALL roles)
DROP POLICY IF EXISTS "View Members" ON public.project_space_members;
DROP POLICY IF EXISTS "view_own_membership" ON public.project_space_members;

CREATE POLICY "view_own_membership" ON public.project_space_members
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() 
    OR 
    public.check_is_project_member(project_space_id) 
    OR 
    public.check_is_project_creator(project_space_id)
);

-- 3. ENSURE GRANTS
GRANT SELECT ON public.project_space_join_requests TO authenticated;
GRANT SELECT ON public.project_space_members TO authenticated;
