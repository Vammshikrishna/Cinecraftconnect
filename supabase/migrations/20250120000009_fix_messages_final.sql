-- Final fix for room_messages and related query issues

-- 1. Ensure foreign key from room_messages.user_id to profiles exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'room_messages_user_id_fkey'
        AND table_name = 'room_messages'
    ) THEN
        ALTER TABLE public.room_messages 
        ADD CONSTRAINT room_messages_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Update room_messages SELECT policy to be more permissive for testing
DROP POLICY IF EXISTS "room_messages_select_policy" ON public.room_messages;
CREATE POLICY "room_messages_select_policy" ON public.room_messages
    FOR SELECT USING (
        -- Allow if user is authenticated (for now - can tighten later)
        auth.uid() IS NOT NULL
    );

-- 3. Update room_messages INSERT policy
DROP POLICY IF EXISTS "room_messages_insert_policy" ON public.room_messages;
CREATE POLICY "room_messages_insert_policy" ON public.room_messages
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND auth.uid() IS NOT NULL
    );

-- 4. Ensure discussion_rooms SELECT policy allows authenticated users
DROP POLICY IF EXISTS "discussion_rooms_select_policy" ON public.discussion_rooms;
CREATE POLICY "discussion_rooms_select_policy" ON public.discussion_rooms
    FOR SELECT USING (
        auth.uid() IS NOT NULL
    );

-- 5. Ensure room_members can be queried by authenticated users
DROP POLICY IF EXISTS "room_members_select_policy" ON public.room_members;
CREATE POLICY "room_members_select_policy" ON public.room_members
    FOR SELECT USING (
        auth.uid() IS NOT NULL
    );

-- 6. Make sure profiles are viewable (needed for the join in the messages query)
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles
    FOR SELECT USING (true);

-- 7. Add index for better join performance
CREATE INDEX IF NOT EXISTS idx_room_messages_user_id ON public.room_messages(user_id);

-- 8. Verify RLS is enabled
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
