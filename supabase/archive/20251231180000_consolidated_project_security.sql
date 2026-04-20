-- ============================================================================
-- CONSOLIDATED PROJECT SECURITY & ACCESS CONTROL
-- ============================================================================
-- Including:
-- 1. Helper Functions (Recursion-free)
-- 2. Join Request RPCs (Atomic & Secure)
-- 3. Data Cleanup (Remove Duplicates)
-- 4. Definitive RLS Policies (Privacy & Discovery)

-- ============================================================================
-- 1. HELPER FUNCTIONS
-- ============================================================================

-- Check if user is creator (Optimized)
CREATE OR REPLACE FUNCTION public.check_is_project_creator(_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Handle both Project ID and Space ID inputs if possible, but for now strict Project ID
  RETURN EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = _project_id
    AND creator_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Check if user is member (Recursion-free, handles self-view)
-- Using _project_id param name to match existing signatures and dependent policies
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


-- ============================================================================
-- 2. JOIN REQUEST RPCs
-- ============================================================================

-- Approve Request (Atomic: Update Status + Insert Member)
CREATE OR REPLACE FUNCTION public.approve_join_request(_request_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
    _user_id UUID;
    _space_id UUID;
BEGIN
    SELECT user_id, project_space_id INTO _user_id, _space_id
    FROM public.project_space_join_requests
    WHERE id = _request_id;

    IF _user_id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;

    -- Verify Permissions (Caller must be Creator)
    IF NOT public.is_project_creator(_space_id) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- 1. Update Request Status
    UPDATE public.project_space_join_requests
    SET status = 'approved'
    WHERE id = _request_id;

    -- 2. Add to Members (Idempotent insert)
    INSERT INTO public.project_space_members (project_space_id, user_id, role)
    VALUES (_space_id, _user_id, 'member')
    ON CONFLICT (project_space_id, user_id) DO NOTHING;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reject Request
CREATE OR REPLACE FUNCTION public.reject_join_request(_request_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
    _space_id UUID;
BEGIN
    SELECT project_space_id INTO _space_id
    FROM public.project_space_join_requests
    WHERE id = _request_id;

    IF _space_id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;

    IF NOT public.is_project_creator(_space_id) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    UPDATE public.project_space_join_requests
    SET status = 'rejected'
    WHERE id = _request_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 3. DATA CLEANUP & CONSTRAINTS
-- ============================================================================

-- Cleanup Duplicate Join Requests
DELETE FROM public.project_space_join_requests
WHERE id NOT IN (
    SELECT MAX(id)
    FROM public.project_space_join_requests
    GROUP BY project_space_id, user_id
);

-- Constraint: One request per user per space
ALTER TABLE public.project_space_join_requests
DROP CONSTRAINT IF EXISTS unique_request_per_user;
ALTER TABLE public.project_space_join_requests
ADD CONSTRAINT unique_request_per_user UNIQUE (project_space_id, user_id);


-- Cleanup Duplicate Project Spaces
DO $$
DECLARE
    dup RECORD;
BEGIN
    FOR dup IN 
        SELECT project_id 
        FROM public.project_spaces 
        GROUP BY project_id 
        HAVING count(*) > 1
    LOOP
        DELETE FROM public.project_spaces
        WHERE project_id = dup.project_id
        AND id NOT IN (
            SELECT id FROM public.project_spaces
            WHERE project_id = dup.project_id
            ORDER BY created_at ASC
            LIMIT 1
        );
    END LOOP;
END $$;

-- Constraint: One space per project
ALTER TABLE public.project_spaces
DROP CONSTRAINT IF EXISTS unique_space_per_project;
ALTER TABLE public.project_spaces
ADD CONSTRAINT unique_space_per_project UNIQUE (project_id);


-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

-- A. PROJECT SPACES (Discovery)
DROP POLICY IF EXISTS "View Project Spaces" ON public.project_spaces;
CREATE POLICY "View Project Spaces" ON public.project_spaces
FOR SELECT USING (
  -- Public/Private: Visible to all authenticated
  (project_space_type::text IN ('public', 'private') AND auth.role() = 'authenticated')
  -- Secret: Only members/creator
  OR (project_space_type::text = 'secret' AND (public.is_project_member(id) OR public.check_is_project_creator(project_id)))
  -- Members/Creator always see
  OR public.is_project_member(id)
  OR public.check_is_project_creator(project_id)
);


-- B. MEMBERS (Visibility & Security)
DROP POLICY IF EXISTS "View Members" ON public.project_space_members;
DROP POLICY IF EXISTS "View Space Members" ON public.project_space_members;
DROP POLICY IF EXISTS "view_own_membership" ON public.project_space_members;

CREATE POLICY "view_members_definitive" ON public.project_space_members
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() -- Can see self
    OR public.check_is_project_member(project_space_id) -- Can see teammates
    OR public.check_is_project_creator(project_space_id) -- Creator can see all
);

DROP POLICY IF EXISTS "Add Members" ON public.project_space_members;
CREATE POLICY "creator_add_members" ON public.project_space_members
FOR INSERT WITH CHECK (
  public.is_project_creator(project_space_id)
);


-- C. JOIN REQUESTS (User Management)
DROP POLICY IF EXISTS "Users can view their own requests" ON public.project_space_join_requests;
DROP POLICY IF EXISTS "Manage Own Requests" ON public.project_space_join_requests;
DROP POLICY IF EXISTS "view_own_requests" ON public.project_space_join_requests;
DROP POLICY IF EXISTS "Creator View Requests" ON public.project_space_join_requests;

-- Users: View & Create own requests
CREATE POLICY "user_manage_own_requests" ON public.project_space_join_requests
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Creator: View requests (Update handled by RPC)
CREATE POLICY "creator_view_requests" ON public.project_space_join_requests
FOR SELECT
TO authenticated
USING (public.is_project_creator(project_space_id));


-- D. CONTENT LOCK (Strict Member Check)
-- Messages
DROP POLICY IF EXISTS "View Messages" ON public.project_space_messages;
CREATE POLICY "strict_view_messages" ON public.project_space_messages
FOR SELECT USING (public.is_project_member(project_space_id) OR public.is_project_creator(project_space_id));

-- Tasks
DROP POLICY IF EXISTS "View Tasks" ON public.tasks;
CREATE POLICY "strict_view_tasks" ON public.tasks
FOR SELECT USING (public.is_project_member(project_space_id) OR public.is_project_creator(project_space_id));

-- Files
DROP POLICY IF EXISTS "View Files" ON public.files;
CREATE POLICY "strict_view_files" ON public.files
FOR SELECT USING (public.is_project_member(project_id) OR public.is_project_creator(project_id));


-- E. GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_space_join_requests TO authenticated;
GRANT SELECT, INSERT ON public.project_space_members TO authenticated;
