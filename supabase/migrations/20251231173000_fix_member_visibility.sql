-- ============================================================================
-- FIX MEMBER VISIBILITY (SELF-VIEW)
-- ============================================================================
-- The previous policy relied solely on 'is_project_member()', which might fail or recurse
-- when a user is trying to check their OWN membership status for the first time.
-- We explicitly allow a user to ALWAYS see their own rows in 'project_space_members'.

DROP POLICY IF EXISTS "View Members" ON public.project_space_members;

CREATE POLICY "View Members" ON public.project_space_members
FOR SELECT USING (
  -- 1. I can see myself (Recursion breaker & Critical for access checks)
  user_id = auth.uid()
  
  -- 2. OR I am a member of the space (so I can see teammates)
  OR public.check_is_project_member(project_space_id)
  
  -- 3. OR I am the creator
  OR public.check_is_project_creator(project_space_id)
);

-- Ensure the helper function is robust
-- We use _project_id as the parameter name to match the existing signature and avoid dropping dependent policies.
-- (Note: It logically represents a project_space_id here, but we keep the name for compatibility)
CREATE OR REPLACE FUNCTION public.check_is_project_member(_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_space_members
    WHERE project_space_id = _project_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
