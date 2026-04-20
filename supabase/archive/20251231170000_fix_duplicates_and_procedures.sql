-- ============================================================================
-- FIX DUPLICATES & APPROVAL WORKFLOW
-- ============================================================================

-- 1. CLEANUP DUPLICATES
-- Keep only the most recent request for each (user, space) pair
DELETE FROM public.project_space_join_requests
WHERE id NOT IN (
    SELECT MAX(id)
    FROM public.project_space_join_requests
    GROUP BY project_space_id, user_id
);

-- 2. ADD UNIQUE CONSTRAINT
-- Prevent future duplicates
ALTER TABLE public.project_space_join_requests
DROP CONSTRAINT IF EXISTS unique_request_per_user;

ALTER TABLE public.project_space_join_requests
ADD CONSTRAINT unique_request_per_user UNIQUE (project_space_id, user_id);


-- 3. ATOMIC APPROVAL FUNCTION
-- Handles both updating the request AND adding the member in one transaction.
-- Security Definer ensures specific table RLS doesn't block the logic if the caller is authorized.
CREATE OR REPLACE FUNCTION public.approve_join_request(_request_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    _user_id UUID;
    _space_id UUID;
    _creator_id UUID;
BEGIN
    -- Get Request Details
    SELECT user_id, project_space_id INTO _user_id, _space_id
    FROM public.project_space_join_requests
    WHERE id = _request_id;

    IF _user_id IS NULL THEN
        RAISE EXCEPTION 'Request not found';
    END IF;

    -- Verify Permissions (Caller must be Creator)
    -- We assume RLS on the function execution or check logic here. 
    -- Ideally, the policy on EXECUTE should handle this, or we check manually:
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


-- 4. REJECT FUNCTION
CREATE OR REPLACE FUNCTION public.reject_join_request(_request_id UUID)
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
