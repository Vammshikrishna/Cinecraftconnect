
-- Create a table for calls
CREATE TABLE calls (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id uuid REFERENCES discussion_rooms(id) ON DELETE CASCADE,
    created_by uuid REFERENCES profiles(id) ON DELETE CASCADE,
    call_type TEXT NOT NULL, -- 'audio' or 'video'
    created_at timestamptz DEFAULT now(),
    ended_at timestamptz
);

-- Create a table for call participants
CREATE TABLE call_participants (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    call_id uuid REFERENCES calls(id) ON DELETE CASCADE,
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    joined_at timestamptz DEFAULT now(),
    left_at timestamptz,
    UNIQUE(call_id, user_id)
);

-- RPC function to start a call
CREATE OR REPLACE FUNCTION start_call(room_id uuid, created_by uuid, call_type TEXT)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    new_call_id uuid;
    new_call json;
BEGIN
    -- Insert a new call record
    INSERT INTO calls (room_id, created_by, call_type)
    VALUES (room_id, created_by, call_type)
    RETURNING id INTO new_call_id;

    -- Add the creator as a participant
    INSERT INTO call_participants (call_id, user_id)
    VALUES (new_call_id, created__by);

    -- Return the new call details
    SELECT json_build_object(
        'id', c.id,
        'room_id', c.room_id,
        'created_by', c.created_by,
        'call_type', c.call_type,
        'created_at', c.created_at
    ) INTO new_call
    FROM calls c
    WHERE c.id = new_call_id;

    RETURN new_call;
END;
$$;

-- Policies for calls table
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow members to view calls" ON calls FOR SELECT USING (is_room_member(room_id, auth.uid()));
CREATE POLICY "Allow members to create calls" ON calls FOR INSERT WITH CHECK (is_room_member(room_id, auth.uid()));
CREATE POLICY "Allow creator to end calls" ON calls FOR UPDATE USING (created_by = auth.uid());

-- Policies for call_participants table
ALTER TABLE call_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow members to see participants" ON call_participants FOR SELECT USING (is_room_member((SELECT room_id FROM calls WHERE id = call_id), auth.uid()));
CREATE POLICY "Allow members to join/leave calls" ON call_participants FOR ALL USING (is_room_member((SELECT room_id FROM calls WHERE id = call_id), auth.uid()));

-- Helper function to check room membership
CREATE OR REPLACE FUNCTION is_room_member(p_room_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM room_members
        WHERE room_id = p_room_id AND user_id = p_user_id
    );
$$;
