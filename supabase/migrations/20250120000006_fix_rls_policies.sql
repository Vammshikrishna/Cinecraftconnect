-- Fix RLS policies causing infinite recursion and permission issues

-- 1. Fix room_members infinite recursion policy
DROP POLICY IF EXISTS "Users can see the members of rooms they are in." ON public.room_members;
CREATE POLICY "Users can see the members of rooms they are in." ON public.room_members
  FOR SELECT USING (
    -- Allow viewing if user is a member of the room
    EXISTS (
      SELECT 1 FROM public.discussion_rooms dr
      WHERE dr.id = room_members.room_id 
      AND (dr.is_public = true OR dr.creator_id = auth.uid())
    )
    OR user_id = auth.uid()
  );

-- 2. Fix posts RLS - allow authenticated users to insert posts
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
CREATE POLICY "Authenticated users can create posts" 
    ON public.posts 
    FOR INSERT 
    WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = author_id);

-- 3. Ensure posts can be viewed by everyone
DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;
CREATE POLICY "Anyone can view posts" 
    ON public.posts 
    FOR SELECT 
    USING (true);

-- 4. Fix project_spaces policies - ensure public projects are viewable
DROP POLICY IF EXISTS "Users can view all public project_spaces" ON public.project_spaces;
CREATE POLICY "Users can view all public project_spaces" 
    ON public.project_spaces 
    FOR SELECT 
    USING (project_space_type = 'public' OR creator_id = auth.uid());

-- 5. Fix project_space_members - allow viewing members
DROP POLICY IF EXISTS "Users can view members of project_spaces they are in" ON public.project_space_members;
CREATE POLICY "Users can view members of project_spaces they are in" 
    ON public.project_space_members 
    FOR SELECT 
    USING (
      user_id = auth.uid() 
      OR project_space_id IN (
        SELECT id FROM public.project_spaces 
        WHERE creator_id = auth.uid() OR project_space_type = 'public'
      )
    );

-- 6. Add policy for viewing all profiles (needed for connections/network)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." 
    ON public.profiles 
    FOR SELECT 
    USING (true);

-- 7. Fix discussion_rooms policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view public discussion rooms." ON public.discussion_rooms;
DROP POLICY IF EXISTS "Users can view private discussion rooms they are a member of." ON public.discussion_rooms;

-- Create a single comprehensive SELECT policy for discussion_rooms
CREATE POLICY "Users can view discussion rooms" ON public.discussion_rooms
  FOR SELECT USING (
    is_public = true 
    OR creator_id = auth.uid()
    OR id IN (
      SELECT room_id FROM public.room_members WHERE user_id = auth.uid()
    )
  );

-- 8. Ensure room_messages can be viewed properly
DROP POLICY IF EXISTS "Users can view messages in rooms they are members of" ON public.room_messages;
CREATE POLICY "Users can view messages in rooms" ON public.room_messages
  FOR SELECT USING (
    -- Can view if room is public
    EXISTS (
      SELECT 1 FROM public.discussion_rooms 
      WHERE id = room_messages.room_id AND is_public = true
    )
    -- OR if user created the room
    OR EXISTS (
      SELECT 1 FROM public.discussion_rooms 
      WHERE id = room_messages.room_id AND creator_id = auth.uid()
    )
    -- OR if it's a project-linked room and user is a project member
    OR EXISTS (
      SELECT 1 FROM public.discussion_rooms dr
      JOIN public.project_space_members psm ON psm.project_space_id = dr.project_id
      WHERE dr.id = room_messages.room_id AND psm.user_id = auth.uid()
    )
  );

-- 9. Fix room_messages INSERT policy
DROP POLICY IF EXISTS "Users can insert messages in rooms they are members of" ON public.room_messages;
CREATE POLICY "Users can insert messages in rooms" ON public.room_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND (
      -- Can insert if room is public
      EXISTS (
        SELECT 1 FROM public.discussion_rooms 
        WHERE id = room_messages.room_id AND is_public = true
      )
      -- OR if user created the room
      OR EXISTS (
        SELECT 1 FROM public.discussion_rooms 
        WHERE id = room_messages.room_id AND creator_id = auth.uid()
      )
      -- OR if it's a project-linked room and user is a project member
      OR EXISTS (
        SELECT 1 FROM public.discussion_rooms dr
        JOIN public.project_space_members psm ON psm.project_space_id = dr.project_id
        WHERE dr.id = room_messages.room_id AND psm.user_id = auth.uid()
      )
    )
  );

-- 10. Add index to improve policy performance
CREATE INDEX IF NOT EXISTS idx_discussion_rooms_is_public ON public.discussion_rooms(is_public);
CREATE INDEX IF NOT EXISTS idx_project_spaces_type ON public.project_spaces(project_space_type);
