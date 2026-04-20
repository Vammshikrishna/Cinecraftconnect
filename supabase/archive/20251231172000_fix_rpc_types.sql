-- ============================================================================
-- FIX RPC PARAMETER TYPES (UUID -> BIGINT)
-- ============================================================================
-- The table 'project_space_join_requests' apparently uses BIGINT/INTEGER for its primary key 'id',
-- not UUID. The previous functions expected UUID, causing "invalid input syntax" errors.
-- We must drop the UUID versions and recreate them as BIGINT versions.

-- 1. DROP OLD FUNCTIONS (UUID versions)
DROP FUNCTION IF EXISTS public.approve_join_request(UUID);
DROP FUNCTION IF EXISTS public.reject_join_request(UUID);

-- 2. RECREATE APPROVE FUNCTION (BIGINT)
CREATE OR REPLACE FUNCTION public.approve_join_request(_request_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
    _user_id UUID;
    _space_id UUID;
BEGIN
    -- Get Request Details
    SELECT user_id, project_space_id INTO _user_id, _space_id
    FROM public.project_space_join_requests
    WHERE id = _request_id;

    IF _user_id IS NULL THEN
        RAISE EXCEPTION 'Request not found';
    END IF;

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


-- 3. RECREATE REJECT FUNCTION (BIGINT)
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
