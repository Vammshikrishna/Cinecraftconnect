-- ============================================================================
-- COMPREHENSIVE APP-WIDE SECURITY POLICIES (STRICT AUTHENTICATION)
-- ============================================================================
-- Updated: CORRECTED column names based on user diagnostic output
-- project_messages -> sender_id
-- project_space_messages -> user_id
-- ============================================================================

-- 1. HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_member_of_project(_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_space_members 
    WHERE project_space_id = _project_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_member_of_room(_room_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.room_members 
    WHERE room_id = _room_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. PROFILES (Identity)
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public View Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Auth Create Own Profile" ON public.profiles;
DROP POLICY IF EXISTS "Owner Update Profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.profiles;

CREATE POLICY "Public View Profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Auth Create Own Profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Owner Update Profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ============================================================================
-- 3. FEED (Posts, Likes, Comments) - STRICT AUTH
-- ============================================================================
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- POSTS
DROP POLICY IF EXISTS "Auth View Posts" ON public.posts;
DROP POLICY IF EXISTS "Auth Create Posts" ON public.posts;
DROP POLICY IF EXISTS "Owner Manage Posts" ON public.posts;
DROP POLICY IF EXISTS "Public View Posts" ON public.posts;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.posts;

CREATE POLICY "Auth View Posts" ON public.posts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Create Posts" ON public.posts FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = author_id);
CREATE POLICY "Owner Manage Posts" ON public.posts FOR ALL USING (auth.uid() = author_id);

-- COMMENTS
DROP POLICY IF EXISTS "Auth View Comments" ON public.comments;
DROP POLICY IF EXISTS "Auth Create Comments" ON public.comments;
DROP POLICY IF EXISTS "Owner Manage Comments" ON public.comments;
DROP POLICY IF EXISTS "Public View Comments" ON public.comments;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.comments;

CREATE POLICY "Auth View Comments" ON public.comments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Create Comments" ON public.comments FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);
CREATE POLICY "Owner Manage Comments" ON public.comments FOR ALL USING (auth.uid() = user_id);

-- LIKES (Standard table)
DROP POLICY IF EXISTS "Auth View Likes" ON public.likes;
DROP POLICY IF EXISTS "Auth Toggle Likes" ON public.likes;
DROP POLICY IF EXISTS "Public View Likes" ON public.likes;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.likes;

CREATE POLICY "Auth View Likes" ON public.likes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Toggle Likes" ON public.likes FOR ALL USING (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- POST_LIKES (Separate table identified in screenshot)
CREATE TABLE IF NOT EXISTS public.post_likes (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(post_id, user_id)
);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth View Post Likes" ON public.post_likes;
DROP POLICY IF EXISTS "Auth Toggle Post Likes" ON public.post_likes;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.post_likes;

CREATE POLICY "Auth View Post Likes" ON public.post_likes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Toggle Post Likes" ON public.post_likes FOR ALL USING (auth.role() = 'authenticated' AND auth.uid() = user_id);


-- ============================================================================
-- 4. JOBS & APPLICATIONS - PUBLIC VIEW
-- ============================================================================
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- JOBS
DROP POLICY IF EXISTS "Public View Active Jobs" ON public.jobs;
DROP POLICY IF EXISTS "Auth Create Jobs" ON public.jobs;
DROP POLICY IF EXISTS "Owner Manage Jobs" ON public.jobs;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.jobs;

CREATE POLICY "Public View Active Jobs" ON public.jobs FOR SELECT USING (is_active = true);
CREATE POLICY "Auth Create Jobs" ON public.jobs FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = posted_by);
CREATE POLICY "Owner Manage Jobs" ON public.jobs FOR ALL USING (auth.uid() = posted_by);

-- APPLICATIONS
DROP POLICY IF EXISTS "Applicant Create/View" ON public.job_applications;
DROP POLICY IF EXISTS "Employer View Applications" ON public.job_applications;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.job_applications;

CREATE POLICY "Applicant Create/View" ON public.job_applications FOR ALL USING (auth.uid() = applicant_id);
CREATE POLICY "Employer View Applications" ON public.job_applications FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.jobs WHERE id = job_id AND posted_by = auth.uid())
);

-- ============================================================================
-- 5. MARKETPLACE - STRICT AUTH
-- ============================================================================
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- LISTINGS
DROP POLICY IF EXISTS "Auth View Listings" ON public.marketplace_listings;
DROP POLICY IF EXISTS "Auth Create Listings" ON public.marketplace_listings;
DROP POLICY IF EXISTS "Owner Manage Listings" ON public.marketplace_listings;
DROP POLICY IF EXISTS "Public View Listings" ON public.marketplace_listings;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.marketplace_listings;

CREATE POLICY "Auth View Listings" ON public.marketplace_listings FOR SELECT USING (auth.role() = 'authenticated' AND is_active = true);
CREATE POLICY "Auth Create Listings" ON public.marketplace_listings FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);
CREATE POLICY "Owner Manage Listings" ON public.marketplace_listings FOR ALL USING (auth.uid() = user_id);

-- VENDORS
DROP POLICY IF EXISTS "Auth View Vendors" ON public.vendors;
DROP POLICY IF EXISTS "Auth Create Vendors" ON public.vendors;
DROP POLICY IF EXISTS "Owner Manage Vendors" ON public.vendors;
DROP POLICY IF EXISTS "Public View Vendors" ON public.vendors;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.vendors;

CREATE POLICY "Auth View Vendors" ON public.vendors FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Create Vendors" ON public.vendors FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = owner_id);
CREATE POLICY "Owner Manage Vendors" ON public.vendors FOR ALL USING (auth.uid() = owner_id);

-- ============================================================================
-- 6. DISCUSSION ROOMS - STRICT AUTH & JOIN LOGIC
-- ============================================================================
ALTER TABLE public.discussion_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_categories ENABLE ROW LEVEL SECURITY;

-- ROOMS
DROP POLICY IF EXISTS "Auth View Public Rooms" ON public.discussion_rooms;
DROP POLICY IF EXISTS "Auth Create Rooms" ON public.discussion_rooms;
DROP POLICY IF EXISTS "Creator Manage Room" ON public.discussion_rooms;
DROP POLICY IF EXISTS "Public View Rooms" ON public.discussion_rooms;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.discussion_rooms;

CREATE POLICY "Auth View Public Rooms" ON public.discussion_rooms FOR SELECT USING (
  auth.role() = 'authenticated' AND (is_public = true OR public.is_member_of_room(id) OR creator_id = auth.uid())
);
CREATE POLICY "Auth Create Rooms" ON public.discussion_rooms FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Creator Manage Room" ON public.discussion_rooms FOR ALL USING (auth.uid() = creator_id);

-- MEMBERS
DROP POLICY IF EXISTS "View Room Members" ON public.room_members;
DROP POLICY IF EXISTS "Join Room" ON public.room_members;
DROP POLICY IF EXISTS "Leave/Remove Member" ON public.room_members;
DROP POLICY IF EXISTS "Auth Join Room" ON public.room_members;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.room_members;

CREATE POLICY "View Room Members" ON public.room_members FOR SELECT USING (
  auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM public.discussion_rooms 
    WHERE id = room_id AND (is_public = true OR public.is_member_of_room(id))
  )
);
CREATE POLICY "Join Room" ON public.room_members FOR INSERT WITH CHECK (
  (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.discussion_rooms WHERE id = room_id AND is_public = true))
  OR 
  EXISTS (SELECT 1 FROM public.discussion_rooms WHERE id = room_id AND creator_id = auth.uid())
);
CREATE POLICY "Leave/Remove Member" ON public.room_members FOR DELETE USING (
  auth.uid() = user_id 
  OR 
  EXISTS (SELECT 1 FROM public.discussion_rooms WHERE id = room_id AND creator_id = auth.uid())
);

-- CATEGORIES
DROP POLICY IF EXISTS "Auth View Room Categories" ON public.room_categories;
DROP POLICY IF EXISTS "Anyone can view categories" ON public.room_categories;

CREATE POLICY "Auth View Room Categories" ON public.room_categories FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================================
-- 7. PROJECTS - STRICT AUTH
-- ============================================================================
ALTER TABLE public.project_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_space_categories ENABLE ROW LEVEL SECURITY;

-- PROJECTS
DROP POLICY IF EXISTS "Auth View Projects" ON public.project_spaces;
DROP POLICY IF EXISTS "Auth Create Projects" ON public.project_spaces;
DROP POLICY IF EXISTS "Creator Manage Projects" ON public.project_spaces;
DROP POLICY IF EXISTS "View Projects" ON public.project_spaces;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.project_spaces;

CREATE POLICY "Auth View Projects" ON public.project_spaces FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    project_space_type = 'public' 
    OR creator_id = auth.uid() 
    OR public.is_member_of_project(id)
  )
);
CREATE POLICY "Auth Create Projects" ON public.project_spaces FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Creator Manage Projects" ON public.project_spaces FOR ALL USING (auth.uid() = creator_id);

-- CATEGORIES
DROP POLICY IF EXISTS "Auth View Project Categories" ON public.project_space_categories;
DROP POLICY IF EXISTS "Anyone can view categories" ON public.project_space_categories;

CREATE POLICY "Auth View Project Categories" ON public.project_space_categories FOR SELECT USING (auth.role() = 'authenticated');

-- PROJECT MESSAGES (Explicit Policies - Corrected Table/Column Names)
-- Table: project_messages (Uses sender_id)
-- Column: sender_id

ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Member View Project Messages" ON public.project_messages;
DROP POLICY IF EXISTS "Member Send Project Messages" ON public.project_messages;
DROP POLICY IF EXISTS "Project members can view messages" ON public.project_messages;
DROP POLICY IF EXISTS "Project members can send messages" ON public.project_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.project_messages;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.project_messages;

CREATE POLICY "Member View Project Messages" ON public.project_messages 
FOR SELECT USING (public.is_member_of_project(project_id));

CREATE POLICY "Member Send Project Messages" ON public.project_messages 
FOR INSERT WITH CHECK (public.is_member_of_project(project_id) AND auth.uid() = sender_id);

-- PROJECT SPACE MESSAGES (Uses user_id)
-- If this table exists, we use user_id. If it doesn't exist, we create it with user_id.
CREATE TABLE IF NOT EXISTS public.project_space_messages (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_space_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.project_space_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Member View Project Space Messages" ON public.project_space_messages;
DROP POLICY IF EXISTS "Member Send Project Space Messages" ON public.project_space_messages;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.project_space_messages;

CREATE POLICY "Member View Project Space Messages" ON public.project_space_messages 
FOR SELECT USING (public.is_member_of_project(project_space_id));

CREATE POLICY "Member Send Project Space Messages" ON public.project_space_messages 
FOR INSERT WITH CHECK (public.is_member_of_project(project_space_id) AND auth.uid() = user_id);

-- PROJECT MESSAGE READ STATUS (Uses user_id)
CREATE TABLE IF NOT EXISTS public.project_message_read_status (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_read_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(project_id, user_id)
);

ALTER TABLE public.project_message_read_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Member View Read Status" ON public.project_message_read_status;
DROP POLICY IF EXISTS "Update Own Read Status" ON public.project_message_read_status;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.project_message_read_status;

CREATE POLICY "Member View Read Status" ON public.project_message_read_status 
FOR SELECT USING (public.is_member_of_project(project_id));

CREATE POLICY "Update Own Read Status" ON public.project_message_read_status 
FOR ALL USING (auth.uid() = user_id);

-- PROJECT SPACE MESSAGE READ STATUS (Uses user_id)
CREATE TABLE IF NOT EXISTS public.project_space_message_read_status (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_space_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_read_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(project_space_id, user_id)
);

ALTER TABLE public.project_space_message_read_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Member View Space Read Status" ON public.project_space_message_read_status;
DROP POLICY IF EXISTS "Update Own Space Read Status" ON public.project_space_message_read_status;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.project_space_message_read_status;

CREATE POLICY "Member View Space Read Status" ON public.project_space_message_read_status 
FOR SELECT USING (public.is_member_of_project(project_space_id));

CREATE POLICY "Update Own Space Read Status" ON public.project_space_message_read_status 
FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 8. NETWORK - STRICT AUTH
-- ============================================================================
ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth View Connections" ON public.user_connections;
DROP POLICY IF EXISTS "Manage Connections" ON public.user_connections;
DROP POLICY IF EXISTS "View Connections" ON public.user_connections;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.user_connections;

CREATE POLICY "Auth View Connections" ON public.user_connections FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Manage Connections" ON public.user_connections FOR ALL USING (auth.uid() = follower_id);

-- ============================================================================
-- 9. ANNOUNCEMENTS - STRICT AUTH
-- ============================================================================
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth View Announcements" ON public.announcements;
DROP POLICY IF EXISTS "Auth Create Announcements" ON public.announcements;
DROP POLICY IF EXISTS "Author Manage Announcements" ON public.announcements;
DROP POLICY IF EXISTS "Anyone can view announcements" ON public.announcements;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.announcements;

CREATE POLICY "Auth View Announcements" ON public.announcements FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Create Announcements" ON public.announcements FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Author Manage Announcements" ON public.announcements FOR ALL USING (auth.uid() = author_id);

-- ============================================================================
-- 10. REACTIONS (Explicit Policies)
-- ============================================================================
-- Ensure table exists
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    emoji text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View Reactions" ON public.message_reactions;
DROP POLICY IF EXISTS "Manage Own Reactions" ON public.message_reactions;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.message_reactions;

CREATE POLICY "View Reactions" ON public.message_reactions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.conversations c ON m.conversation_id = c.id
    WHERE m.id = message_id AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
  )
);

CREATE POLICY "Manage Own Reactions" ON public.message_reactions FOR ALL USING (auth.uid() = user_id);
