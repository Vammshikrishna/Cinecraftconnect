-- Fix massive data leaks introduced by generic "Allow all for authenticated users" policies

-- 1. CONVERSATIONS (Direct Messages)
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.conversations;

CREATE POLICY "Users view own conversations" ON public.conversations FOR SELECT USING (
  (select auth.uid()) = user1_id OR (select auth.uid()) = user2_id
);

CREATE POLICY "Users insert conversations" ON public.conversations FOR INSERT WITH CHECK (
  (select auth.uid()) = user1_id OR (select auth.uid()) = user2_id
);

-- 2. MESSAGES (Direct Messages Content)
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.messages;

CREATE POLICY "Users view messages in their conversations" ON public.messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversations c 
    WHERE c.id = messages.conversation_id AND (c.user1_id = (select auth.uid()) OR c.user2_id = (select auth.uid()))
  )
);

CREATE POLICY "Users send their own messages" ON public.messages FOR INSERT WITH CHECK (
  (select auth.uid()) = sender_id AND
  EXISTS (
    SELECT 1 FROM public.conversations c 
    WHERE c.id = messages.conversation_id AND (c.user1_id = (select auth.uid()) OR c.user2_id = (select auth.uid()))
  )
);

CREATE POLICY "Users can update read status" ON public.messages FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.conversations c 
    WHERE c.id = messages.conversation_id AND (c.user1_id = (select auth.uid()) OR c.user2_id = (select auth.uid()))
  )
);

CREATE POLICY "Users can delete own messages" ON public.messages FOR DELETE USING (
  (select auth.uid()) = sender_id
);

-- 3. NOTIFICATIONS (Contains private system alerts and invites)
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.notifications;

CREATE POLICY "Users manage own notifications" ON public.notifications FOR ALL USING (
  (select auth.uid()) = user_id
);

-- 4. SHARES 
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.shares;

CREATE POLICY "Anyone view shares" ON public.shares FOR SELECT USING ((select auth.role()) = 'authenticated');
CREATE POLICY "Users insert own shares" ON public.shares FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users delete own shares" ON public.shares FOR DELETE USING ((select auth.uid()) = user_id);

-- 5. USER SKILLS
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.user_skills;

CREATE POLICY "Anyone view skills" ON public.user_skills FOR SELECT USING ((select auth.role()) = 'authenticated');
CREATE POLICY "Users manage own skills" ON public.user_skills FOR ALL USING ((select auth.uid()) = user_id);

-- 6. PROJECT SPACE JOIN REQUESTS (Private)
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.project_space_join_requests;

CREATE POLICY "Users view own project requests or if creator" ON public.project_space_join_requests FOR SELECT USING (
  (select auth.uid()) = user_id OR
  EXISTS (SELECT 1 FROM public.project_spaces ps WHERE ps.id = project_space_id AND ps.creator_id = (select auth.uid()))
);

CREATE POLICY "Users insert own project requests" ON public.project_space_join_requests FOR INSERT WITH CHECK (
  (select auth.uid()) = user_id
);

CREATE POLICY "Creator manage project requests" ON public.project_space_join_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.project_spaces ps WHERE ps.id = project_space_id AND ps.creator_id = (select auth.uid()))
);

CREATE POLICY "Users delete own project requests or creator" ON public.project_space_join_requests FOR DELETE USING (
  (select auth.uid()) = user_id OR
  EXISTS (SELECT 1 FROM public.project_spaces ps WHERE ps.id = project_space_id AND ps.creator_id = (select auth.uid()))
);

-- 7. ROOM JOIN REQUESTS (Private)
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.room_join_requests;

CREATE POLICY "Users view own room requests or if creator" ON public.room_join_requests FOR SELECT USING (
  (select auth.uid()) = user_id OR
  EXISTS (SELECT 1 FROM public.discussion_rooms dr WHERE dr.id = room_id AND dr.creator_id = (select auth.uid()))
);

CREATE POLICY "Users insert own room requests" ON public.room_join_requests FOR INSERT WITH CHECK (
  (select auth.uid()) = user_id
);

CREATE POLICY "Creator manage room requests" ON public.room_join_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.discussion_rooms dr WHERE dr.id = room_id AND dr.creator_id = (select auth.uid()))
);

CREATE POLICY "Users delete own room requests or creator" ON public.room_join_requests FOR DELETE USING (
  (select auth.uid()) = user_id OR
  EXISTS (SELECT 1 FROM public.discussion_rooms dr WHERE dr.id = room_id AND dr.creator_id = (select auth.uid()))
);

-- 8. ROOM MESSAGES (Discussion Rooms Content)
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.room_messages;
DROP POLICY IF EXISTS "Authenticated users can send messages" ON public.room_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.room_messages;

CREATE POLICY "Room members view messages" ON public.room_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.discussion_rooms dr WHERE dr.id = room_messages.room_id AND dr.is_public = true)
  OR
  EXISTS (SELECT 1 FROM public.room_members rm WHERE rm.room_id = room_messages.room_id AND rm.user_id = (select auth.uid()))
  OR
  EXISTS (SELECT 1 FROM public.discussion_rooms dr WHERE dr.id = room_messages.room_id AND dr.creator_id = (select auth.uid()))
);

CREATE POLICY "Room members insert messages" ON public.room_messages FOR INSERT WITH CHECK (
  (select auth.uid()) = user_id AND (
    EXISTS (SELECT 1 FROM public.room_members rm WHERE rm.room_id = room_messages.room_id AND rm.user_id = (select auth.uid()))
    OR
    EXISTS (SELECT 1 FROM public.discussion_rooms dr WHERE dr.id = room_messages.room_id AND dr.creator_id = (select auth.uid()))
  )
);

CREATE POLICY "Users delete own messages" ON public.room_messages FOR DELETE USING (
  (select auth.uid()) = user_id
);

-- 9. CALLS (Discussion Room Video Calls)
DROP POLICY IF EXISTS "Authenticated users can view calls" ON public.calls;

CREATE POLICY "Members view calls in their rooms" ON public.calls FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.discussion_rooms dr WHERE dr.id = calls.room_id AND dr.is_public = true)
  OR
  EXISTS (SELECT 1 FROM public.room_members rm WHERE rm.room_id = calls.room_id AND rm.user_id = (select auth.uid()))
  OR
  EXISTS (SELECT 1 FROM public.discussion_rooms dr WHERE dr.id = calls.room_id AND dr.creator_id = (select auth.uid()))
);
