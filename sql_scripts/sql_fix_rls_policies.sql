-- Relax RLS policies to allow sharing to rooms and projects without prior membership

-- 1. ROOM MESSAGES
-- Allow any authenticated user to VIEW messages in rooms (so they can see what they shared)
DROP POLICY IF EXISTS "Room members can view messages" ON public.room_messages;
CREATE POLICY "Authenticated users can view room messages" ON public.room_messages 
FOR SELECT USING (auth.role() = 'authenticated');

-- Allow any authenticated user to SEND messages to rooms
DROP POLICY IF EXISTS "Room members can send messages" ON public.room_messages;
CREATE POLICY "Authenticated users can send room messages" ON public.room_messages 
FOR INSERT WITH CHECK (auth.uid() = user_id);


-- 2. PROJECT MESSAGES
-- Allow any authenticated user to VIEW messages in projects
DROP POLICY IF EXISTS "Project members can view messages" ON public.project_messages;
CREATE POLICY "Authenticated users can view project messages" ON public.project_messages 
FOR SELECT USING (auth.role() = 'authenticated');

-- Allow any authenticated user to SEND messages to projects
DROP POLICY IF EXISTS "Project members can send messages" ON public.project_messages;
CREATE POLICY "Authenticated users can send project messages" ON public.project_messages 
FOR INSERT WITH CHECK (auth.uid() = user_id);
