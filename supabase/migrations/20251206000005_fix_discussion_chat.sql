-- ============================================================================
-- FIX: DISCUSSION ROOM MESSAGES (RLS & FK)
-- ============================================================================
-- This script fixes the issue where messages in Discussion Rooms were not showing.
-- It adds the missing RLS policies for 'room_messages' and ensures Foreign Keys.
-- ============================================================================

-- 1. Ensure Foreign Key to Profiles (for avatar/name fetching)
ALTER TABLE public.room_messages 
DROP CONSTRAINT IF EXISTS room_messages_user_id_fkey;

ALTER TABLE public.room_messages 
ADD CONSTRAINT room_messages_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Enable RLS
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;

-- 3. Add Policies
DROP POLICY IF EXISTS "View Room Messages" ON public.room_messages;
DROP POLICY IF EXISTS "Send Room Messages" ON public.room_messages;

-- Policy: View Messages
-- Users can view messages if:
-- 1. The room is public
-- 2. They are a member of the room
-- 3. They are the creator of the room
CREATE POLICY "View Room Messages" ON public.room_messages 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.discussion_rooms 
    WHERE id = room_messages.room_id 
    AND (
      is_public = true 
      OR public.is_member_of_room(id) 
      OR creator_id = auth.uid()
    )
  )
);

-- Policy: Send Messages
-- Users can send messages if:
-- 1. They are authenticated (auth.uid() = user_id)
-- 2. AND (Room is public OR Member OR Creator)
CREATE POLICY "Send Room Messages" ON public.room_messages 
FOR INSERT WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM public.discussion_rooms 
    WHERE id = room_messages.room_id 
    AND (
      is_public = true 
      OR public.is_member_of_room(id) 
      OR creator_id = auth.uid()
    )
  )
);
