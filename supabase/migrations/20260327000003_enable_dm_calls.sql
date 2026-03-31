-- Enable Direct Message Calling by updating calls table and RPC
-- This migration handles dropping and recreating policies across multiple tables to allow column type modification.

-- 1. Drop ALL policies that depend on calls.room_id (including related tables)
-- Policies on calls
DROP POLICY IF EXISTS "Members view calls in their rooms" ON public.calls;
DROP POLICY IF EXISTS "Authorized users can update calls" ON public.calls;
DROP POLICY IF EXISTS "Authenticated users can view calls" ON public.calls;
DROP POLICY IF EXISTS "Call creator can update call" ON public.calls;
DROP POLICY IF EXISTS "Users can view calls in their rooms" ON public.calls;
DROP POLICY IF EXISTS "Users can create calls in their rooms" ON public.calls;
DROP POLICY IF EXISTS "Users can update calls they created" ON public.calls;
DROP POLICY IF EXISTS "Authenticated users can view active calls" ON public.calls;
DROP POLICY IF EXISTS "Authenticated users can create calls" ON public.calls;
DROP POLICY IF EXISTS "Users can update their calls" ON public.calls;
DROP POLICY IF EXISTS "Users can view calls in their projects/rooms" ON public.calls;
DROP POLICY IF EXISTS "Project/room members can create calls" ON public.calls;
DROP POLICY IF EXISTS "Users can update calls" ON public.calls;

-- Policies on call_participants
DROP POLICY IF EXISTS "Users can view participants in their calls" ON public.call_participants;
DROP POLICY IF EXISTS "Users can join calls" ON public.call_participants;
DROP POLICY IF EXISTS "Users can update their own participation" ON public.call_participants;

-- Policies on call_reactions
DROP POLICY IF EXISTS "Users can view reactions in their calls" ON public.call_reactions;
DROP POLICY IF EXISTS "Users can create reactions in calls they're in" ON public.call_reactions;

-- 2. Update room_type constraint to allow 'direct'
ALTER TABLE public.calls DROP CONSTRAINT IF EXISTS calls_room_type_check;
ALTER TABLE public.calls ADD CONSTRAINT calls_room_type_check CHECK (room_type IN ('project', 'discussion', 'direct'));

-- 3. Modify room_id to TEXT
ALTER TABLE public.calls ALTER COLUMN room_id TYPE TEXT;

-- 4. Re-create base policies for calls
CREATE POLICY "Authenticated users view calls" ON public.calls 
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users create calls" ON public.calls 
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Owners update active calls" ON public.calls 
FOR UPDATE USING (
    auth.role() = 'authenticated' AND 
    (started_by = auth.uid() OR status = 'active')
);

-- 5. Re-create base policies for call_participants
CREATE POLICY "Authenticated users view participants" ON public.call_participants
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users join calls" ON public.call_participants
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own status" ON public.call_participants
FOR UPDATE USING (auth.uid() = user_id);

-- 6. Re-create base policies for call_reactions
CREATE POLICY "Authenticated users view reactions" ON public.call_reactions
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users react in calls" ON public.call_reactions
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 7. Update the start_call RPC to handle 'direct' rooms
CREATE OR REPLACE FUNCTION public.start_call(p_room_id TEXT, p_created_by UUID, p_call_type TEXT DEFAULT 'video')
RETURNS JSONB AS $$
DECLARE
    new_call_id UUID;
    result JSONB;
    r_type TEXT;
BEGIN
    -- Determine room type
    IF EXISTS (SELECT 1 FROM public.project_spaces WHERE id::TEXT = p_room_id) THEN
        r_type := 'project';
    ELSIF EXISTS (SELECT 1 FROM public.discussion_rooms WHERE id::TEXT = p_room_id) THEN
         r_type := 'discussion';
    ELSE
         r_type := 'direct';
    END IF;

    -- Insert new call
    INSERT INTO public.calls (room_type, room_id, daily_room_name, daily_room_url, started_by, status)
    VALUES (
        r_type, 
        p_room_id, 
        'native-' || p_room_id || '-' || extract(epoch from now()),
        'native',
        p_created_by, 
        'active'
    )
    RETURNING id INTO new_call_id;

    -- Add creator as participant
    INSERT INTO public.call_participants (call_id, user_id, status)
    VALUES (new_call_id, p_created_by, 'joined');

    -- Return the created call object
    SELECT jsonb_build_object(
        'id', c.id,
        'room_id', c.room_id,
        'room_type', c.room_type,
        'started_by', c.started_by,
        'status', c.status,
        'created_at', c.created_at
    ) INTO result
    FROM public.calls c
    WHERE c.id = new_call_id;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
