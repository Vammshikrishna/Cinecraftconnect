-- Drop the functions if they already exist
DROP FUNCTION IF EXISTS approve_join_request(uuid);
DROP FUNCTION IF EXISTS approve_join_request(integer);
DROP FUNCTION IF EXISTS reject_join_request(uuid);
DROP FUNCTION IF EXISTS reject_join_request(integer);

-- Create approve_join_request function
CREATE OR REPLACE FUNCTION approve_join_request(_request_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to bypass RLS to insert members securely
AS $$
DECLARE
    v_project_space_id uuid;
    v_user_id uuid;
BEGIN
    -- Get the request details
    SELECT project_space_id, user_id INTO v_project_space_id, v_user_id
    FROM project_space_join_requests
    WHERE id = _request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Join request not found';
    END IF;

    -- Update the request status
    UPDATE project_space_join_requests
    SET status = 'approved'
    WHERE id = _request_id;

    -- Add the user to project_space_members (if not already a member)
    INSERT INTO project_space_members (project_space_id, user_id, role)
    VALUES (v_project_space_id, v_user_id, 'member')
    ON CONFLICT DO NOTHING;
END;
$$;

-- Create reject_join_request function
CREATE OR REPLACE FUNCTION reject_join_request(_request_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Just update the request status
    UPDATE project_space_join_requests
    SET status = 'rejected'
    WHERE id = _request_id;
END;
$$;
