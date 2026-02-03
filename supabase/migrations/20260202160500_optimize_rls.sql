-- Optimize RLS policies per Supabase linter recommendations
-- This replaces auth.uid() and auth.role() calls with (select auth.uid()) and (select auth.role())
-- to avoid re-evaluation for every row.

-- Helper Functions
CREATE OR REPLACE FUNCTION public.is_member_of_project(_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_space_members 
    WHERE project_space_id = _project_id AND user_id = (select auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_member_of_room(_room_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.room_members 
    WHERE room_id = _room_id AND user_id = (select auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles
DROP POLICY IF EXISTS "Auth Create Own Profile" ON public.profiles;
CREATE POLICY "Auth Create Own Profile" ON public.profiles FOR INSERT WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Owner Update Profile" ON public.profiles;
CREATE POLICY "Owner Update Profile" ON public.profiles FOR UPDATE USING ((select auth.uid()) = id);

-- Posts
DROP POLICY IF EXISTS "Auth View Posts" ON public.posts;
CREATE POLICY "Auth View Posts" ON public.posts FOR SELECT USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Auth Create Posts" ON public.posts;
CREATE POLICY "Auth Create Posts" ON public.posts FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated' AND (select auth.uid()) = author_id);

DROP POLICY IF EXISTS "Owner Manage Posts" ON public.posts;
CREATE POLICY "Owner Manage Posts" ON public.posts FOR ALL USING ((select auth.uid()) = author_id);

-- Post Comments
DROP POLICY IF EXISTS "Auth View Comments" ON public.post_comments;
DROP POLICY IF EXISTS "Authenticated users can create post_comments" ON public.post_comments;
DROP POLICY IF EXISTS "Owner Manage Comments" ON public.post_comments;
DROP POLICY IF EXISTS "Auth Create Comments" ON public.post_comments;

CREATE POLICY "Auth View Comments" ON public.post_comments FOR SELECT USING ((select auth.role()) = 'authenticated');
CREATE POLICY "Auth Create Comments" ON public.post_comments FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated' AND (select auth.uid()) = user_id);
CREATE POLICY "Owner Manage Comments" ON public.post_comments FOR ALL USING ((select auth.uid()) = user_id);

-- Comments (Generic/Original)
DROP POLICY IF EXISTS "Auth View Comments" ON public.comments;
CREATE POLICY "Auth View Comments" ON public.comments FOR SELECT USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Auth Create Comments" ON public.comments;
CREATE POLICY "Auth Create Comments" ON public.comments FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated' AND (select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Owner Manage Comments" ON public.comments;
CREATE POLICY "Owner Manage Comments" ON public.comments FOR ALL USING ((select auth.uid()) = user_id);

-- Likes
DROP POLICY IF EXISTS "Auth View Likes" ON public.likes;
CREATE POLICY "Auth View Likes" ON public.likes FOR SELECT USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Auth Toggle Likes" ON public.likes;
CREATE POLICY "Auth Toggle Likes" ON public.likes FOR ALL USING ((select auth.role()) = 'authenticated' AND (select auth.uid()) = user_id);

-- Post Likes
DROP POLICY IF EXISTS "Auth View Post Likes" ON public.post_likes;
CREATE POLICY "Auth View Post Likes" ON public.post_likes FOR SELECT USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Auth Toggle Post Likes" ON public.post_likes;
CREATE POLICY "Auth Toggle Post Likes" ON public.post_likes FOR ALL USING ((select auth.role()) = 'authenticated' AND (select auth.uid()) = user_id);

-- Jobs
DROP POLICY IF EXISTS "Auth Create Jobs" ON public.jobs;
CREATE POLICY "Auth Create Jobs" ON public.jobs FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated' AND (select auth.uid()) = posted_by);

DROP POLICY IF EXISTS "Owner Manage Jobs" ON public.jobs;
CREATE POLICY "Owner Manage Jobs" ON public.jobs FOR ALL USING ((select auth.uid()) = posted_by);

-- Job Applications
DROP POLICY IF EXISTS "Applicant Create/View" ON public.job_applications;
CREATE POLICY "Applicant Create/View" ON public.job_applications FOR ALL USING ((select auth.uid()) = applicant_id);

DROP POLICY IF EXISTS "Employer View Applications" ON public.job_applications;
CREATE POLICY "Employer View Applications" ON public.job_applications FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.jobs WHERE id = job_id AND posted_by = (select auth.uid()))
);

-- Marketplace Listings
DROP POLICY IF EXISTS "Auth View Listings" ON public.marketplace_listings;
CREATE POLICY "Auth View Listings" ON public.marketplace_listings FOR SELECT USING ((select auth.role()) = 'authenticated' AND is_active = true);

DROP POLICY IF EXISTS "Auth Create Listings" ON public.marketplace_listings;
CREATE POLICY "Auth Create Listings" ON public.marketplace_listings FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated' AND (select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Owner Manage Listings" ON public.marketplace_listings;
CREATE POLICY "Owner Manage Listings" ON public.marketplace_listings FOR ALL USING ((select auth.uid()) = user_id);

-- Vendors
DROP POLICY IF EXISTS "Auth View Vendors" ON public.vendors;
CREATE POLICY "Auth View Vendors" ON public.vendors FOR SELECT USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Auth Create Vendors" ON public.vendors;
CREATE POLICY "Auth Create Vendors" ON public.vendors FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated' AND (select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "Owner Manage Vendors" ON public.vendors;
CREATE POLICY "Owner Manage Vendors" ON public.vendors FOR ALL USING ((select auth.uid()) = owner_id);

-- Discussion Rooms
DROP POLICY IF EXISTS "Auth View Public Rooms" ON public.discussion_rooms;
CREATE POLICY "Auth View Public Rooms" ON public.discussion_rooms FOR SELECT USING (
  (select auth.role()) = 'authenticated' AND (is_public = true OR public.is_member_of_room(id) OR creator_id = (select auth.uid()))
);

DROP POLICY IF EXISTS "Auth Create Rooms" ON public.discussion_rooms;
CREATE POLICY "Auth Create Rooms" ON public.discussion_rooms FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Creator Manage Room" ON public.discussion_rooms;
CREATE POLICY "Creator Manage Room" ON public.discussion_rooms FOR ALL USING ((select auth.uid()) = creator_id);

-- Room Members
DROP POLICY IF EXISTS "Join Room" ON public.room_members;
CREATE POLICY "Join Room" ON public.room_members FOR INSERT WITH CHECK (
  ((select auth.uid()) = user_id AND EXISTS (SELECT 1 FROM public.discussion_rooms WHERE id = room_id AND is_public = true))
  OR 
  EXISTS (SELECT 1 FROM public.discussion_rooms WHERE id = room_id AND creator_id = (select auth.uid()))
);

DROP POLICY IF EXISTS "Leave/Remove Member" ON public.room_members;
CREATE POLICY "Leave/Remove Member" ON public.room_members FOR DELETE USING (
  (select auth.uid()) = user_id 
  OR 
  EXISTS (SELECT 1 FROM public.discussion_rooms WHERE id = room_id AND creator_id = (select auth.uid()))
);

-- Room Categories
DROP POLICY IF EXISTS "Auth View Room Categories" ON public.room_categories;
CREATE POLICY "Auth View Room Categories" ON public.room_categories FOR SELECT USING ((select auth.role()) = 'authenticated');

-- Project Spaces
DROP POLICY IF EXISTS "Auth View Projects" ON public.project_spaces;
CREATE POLICY "Auth View Projects" ON public.project_spaces FOR SELECT USING (
  (select auth.role()) = 'authenticated' AND (
    project_space_type = 'public' 
    OR creator_id = (select auth.uid()) 
    OR public.is_member_of_project(id)
  )
);

DROP POLICY IF EXISTS "Auth Create Projects" ON public.project_spaces;
CREATE POLICY "Auth Create Projects" ON public.project_spaces FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Creator Manage Projects" ON public.project_spaces;
CREATE POLICY "Creator Manage Projects" ON public.project_spaces FOR ALL USING ((select auth.uid()) = creator_id);

-- Project Space Categories
DROP POLICY IF EXISTS "Auth View Project Categories" ON public.project_space_categories;
CREATE POLICY "Auth View Project Categories" ON public.project_space_categories FOR SELECT USING ((select auth.role()) = 'authenticated');

-- Project Messages
DROP POLICY IF EXISTS "Member Send Project Messages" ON public.project_messages;
CREATE POLICY "Member Send Project Messages" ON public.project_messages 
FOR INSERT WITH CHECK (public.is_member_of_project(project_id) AND (select auth.uid()) = user_id);

-- Project Space Messages
DROP POLICY IF EXISTS "Member Send Project Space Messages" ON public.project_space_messages;
CREATE POLICY "Member Send Project Space Messages" ON public.project_space_messages 
FOR INSERT WITH CHECK (public.is_member_of_project(project_space_id) AND (select auth.uid()) = user_id);

-- Project Message Read Status
DROP POLICY IF EXISTS "Update Own Read Status" ON public.project_message_read_status;
CREATE POLICY "Update Own Read Status" ON public.project_message_read_status 
FOR ALL USING ((select auth.uid()) = user_id);

-- Project Space Message Read Status
DROP POLICY IF EXISTS "Update Own Space Read Status" ON public.project_space_message_read_status;
CREATE POLICY "Update Own Space Read Status" ON public.project_space_message_read_status 
FOR ALL USING ((select auth.uid()) = user_id);

-- User Connections
DROP POLICY IF EXISTS "Auth View Connections" ON public.user_connections;
CREATE POLICY "Auth View Connections" ON public.user_connections FOR SELECT USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Manage Connections" ON public.user_connections;
CREATE POLICY "Manage Connections" ON public.user_connections FOR ALL USING ((select auth.uid()) = follower_id);

-- Announcements
DROP POLICY IF EXISTS "Auth View Announcements" ON public.announcements;
CREATE POLICY "Auth View Announcements" ON public.announcements FOR SELECT USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Auth Create Announcements" ON public.announcements;
CREATE POLICY "Auth Create Announcements" ON public.announcements FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Author Manage Announcements" ON public.announcements;
CREATE POLICY "Author Manage Announcements" ON public.announcements FOR ALL USING ((select auth.uid()) = author_id);

-- Message Reactions
DROP POLICY IF EXISTS "View Reactions" ON public.message_reactions;
CREATE POLICY "View Reactions" ON public.message_reactions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.conversations c ON m.conversation_id = c.id
    WHERE m.id = message_id AND (c.user1_id = (select auth.uid()) OR c.user2_id = (select auth.uid()))
  )
);

DROP POLICY IF EXISTS "Manage Own Reactions" ON public.message_reactions;
CREATE POLICY "Manage Own Reactions" ON public.message_reactions FOR ALL USING ((select auth.uid()) = user_id);

-- Allow all for authenticated users (Generic)
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.conversations;
CREATE POLICY "Allow all for authenticated users" ON public.conversations FOR ALL USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.messages;
CREATE POLICY "Allow all for authenticated users" ON public.messages FOR ALL USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.notifications;
CREATE POLICY "Allow all for authenticated users" ON public.notifications FOR ALL USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.shares;
CREATE POLICY "Allow all for authenticated users" ON public.shares FOR ALL USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.user_skills;
CREATE POLICY "Allow all for authenticated users" ON public.user_skills FOR ALL USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.project_space_join_requests;
CREATE POLICY "Allow all for authenticated users" ON public.project_space_join_requests FOR ALL USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.room_join_requests;
CREATE POLICY "Allow all for authenticated users" ON public.room_join_requests FOR ALL USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.room_messages;
CREATE POLICY "Allow all for authenticated users" ON public.room_messages FOR ALL USING ((select auth.role()) = 'authenticated');

-- Additional Room Messages Policies
DROP POLICY IF EXISTS "Authenticated users can send messages" ON public.room_messages;
CREATE POLICY "Authenticated users can send messages" ON public.room_messages FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own messages" ON public.room_messages;
CREATE POLICY "Users can delete their own messages" ON public.room_messages FOR DELETE USING ((select auth.uid()) = user_id);

-- Calls
DROP POLICY IF EXISTS "Authenticated users can view calls" ON public.calls;
CREATE POLICY "Authenticated users can view calls" ON public.calls FOR SELECT USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Call creator can update call" ON public.calls;
CREATE POLICY "Call creator can update call" ON public.calls FOR UPDATE USING ((select auth.uid()) = started_by);
