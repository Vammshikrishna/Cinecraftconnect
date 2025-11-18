-- Custom Types
CREATE TYPE call_type AS ENUM ('audio', 'video');
CREATE TYPE call_status AS ENUM ('active', 'ended');

-- Helper function to check project_space membership
CREATE OR REPLACE FUNCTION is_project_space_member(p_project_space_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM project_space_members
        WHERE project_space_id = p_project_space_id AND user_id = p_user_id
    );
$$;

-- Video Calls Table
CREATE TABLE IF NOT EXISTS public.calls (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_space_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type call_type NOT NULL,
    status call_status NOT NULL DEFAULT 'active',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    ended_at timestamp with time zone
);

-- Call Participants Table
CREATE TABLE IF NOT EXISTS public.call_participants (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at timestamp with time zone NOT NULL DEFAULT now(),
    left_at timestamp with time zone
);

-- RLS Policies for calls
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow members to view video calls" ON public.calls FOR SELECT
    USING (is_project_space_member(project_space_id, auth.uid()));

CREATE POLICY "Allow members to create video calls" ON public.calls FOR INSERT
    WITH CHECK (is_project_space_member(project_space_id, auth.uid()));

CREATE POLICY "Allow creator to end video calls" ON public.calls FOR UPDATE
    USING (created_by = auth.uid());

-- RLS Policies for call_participants
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow participants to view their own data" ON public.call_participants FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Allow members to join calls" ON public.call_participants FOR INSERT
    WITH CHECK (is_project_space_member((SELECT project_space_id FROM public.calls WHERE id = call_id), auth.uid()));

CREATE POLICY "Allow participants to update their own data" ON public.call_participants FOR UPDATE
    USING (user_id = auth.uid());


-- Function to start a call
CREATE OR REPLACE FUNCTION start_call(
    p_project_space_id uuid,
    p_created_by uuid,
    p_call_type call_type
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_call_id uuid;
    v_call json;
BEGIN
    -- Check if user is a member of the project_space
    IF NOT is_project_space_member(p_project_space_id, p_created_by) THEN
        RAISE EXCEPTION 'User is not a member of the project_space';
    END IF;

    -- End any active calls in the project_space
    UPDATE public.calls
    SET status = 'ended', ended_at = now()
    WHERE project_space_id = p_project_space_id AND status = 'active';

    -- Insert a new call record
    INSERT INTO public.calls (project_space_id, created_by, type)
    VALUES (p_project_space_id, p_created_by, p_call_type)
    RETURNING id INTO v_call_id;

    -- Automatically add the creator as a participant
    INSERT INTO public.call_participants (call_id, user_id)
    VALUES (v_call_id, p_created_by);

    -- Return the new call details
    SELECT json_build_object(
        'id', c.id,
        'project_space_id', c.project_space_id,
        'created_by', c.created_by,
        'type', c.type,
        'status', c.status,
        'created_at', c.created_at
    )
    INTO v_call
    FROM public.calls c
    WHERE c.id = v_call_id;

    RETURN v_call;
END;
$$;

-- Function to end a call
CREATE OR REPLACE FUNCTION end_call(
    p_call_id uuid,
    p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if the user is the creator of the call
    IF NOT EXISTS (
        SELECT 1
        FROM public.calls
        WHERE id = p_call_id AND created_by = p_user_id
    ) THEN
        RAISE EXCEPTION 'Only the call creator can end the call';
    END IF;

    -- Update the call status
    UPDATE public.calls
    SET status = 'ended', ended_at = now()
    WHERE id = p_call_id;

    -- Update all participants' left_at time
    UPDATE public.call_participants
    SET left_at = now()
    WHERE call_id = p_call_id AND left_at IS NULL;
END;
$$;

-- Function for a user to join a call
CREATE OR REPLACE FUNCTION join_call(
    p_call_id uuid,
    p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_project_space_id uuid;
BEGIN
    -- Get the project_space_id from the call
    SELECT project_space_id INTO v_project_space_id
    FROM public.calls
    WHERE id = p_call_id;

    -- Check if user is a member of the project_space
    IF NOT is_project_space_member(v_project_space_id, p_user_id) THEN
        RAISE EXCEPTION 'User is not a member of the project_space';
    END IF;

    -- Add the user to the participants, if they are not already in
    INSERT INTO public.call_participants (call_id, user_id)
    VALUES (p_call_id, p_user_id)
    ON CONFLICT (call_id, user_id) DO NOTHING;
END;
$$;

-- Function for a user to leave a call
CREATE OR REPLACE FUNCTION leave_call(
    p_call_id uuid,
    p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.call_participants
    SET left_at = now()
    WHERE call_id = p_call_id AND user_id = p_user_id AND left_at IS NULL;
END;
$$;