-- ============================================================================
-- COMPLETE DATABASE SETUP FOR NEW SUPABASE PROJECT
-- Run this in your Supabase SQL Editor to set up all tables
-- ============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create profiles table first (base for all relationships)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    updated_at timestamp with time zone,
    username text UNIQUE,
    full_name text,
    avatar_url text,
    website text,
    bio text,
    location text,
    experience text,
    craft text,
    instagram_url text,
    youtube_url text,
    CONSTRAINT username_length CHECK (char_length(username) >= 3)
);

-- 3. Create projects table (main projects table the app uses)
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    status TEXT DEFAULT 'planning',
    start_date DATE,
    end_date DATE,
    location TEXT,
    budget_min NUMERIC,
    budget_max NUMERIC,
    is_public BOOLEAN DEFAULT true,
    genre TEXT[],
    required_roles TEXT[],
    current_team JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Project-related tables
CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member' NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(project_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.project_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. Posts table
CREATE TABLE IF NOT EXISTS public.posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text NOT NULL,
    media_url text,
    media_type text,
    tags text[],
    like_count integer DEFAULT 0,
    comment_count integer DEFAULT 0,
    share_count integer DEFAULT 0,
    has_ai_generated boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.likes (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.comments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    parent_comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.shares (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (post_id, user_id)
);

-- 6. Discussion Rooms
CREATE TABLE IF NOT EXISTS public.room_categories (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.discussion_rooms (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    title text NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    is_public boolean DEFAULT true,
    member_count integer DEFAULT 0,
    room_type text DEFAULT 'public',
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    creator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    category_id uuid REFERENCES public.room_categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.room_members (
    room_id uuid NOT NULL REFERENCES public.discussion_rooms(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.room_messages (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id uuid NOT NULL REFERENCES public.discussion_rooms(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    priority text DEFAULT 'normal',
    visibility_role text DEFAULT 'everyone'
);

CREATE TABLE IF NOT EXISTS public.room_join_requests (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    room_id uuid NOT NULL REFERENCES public.discussion_rooms(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status text DEFAULT 'pending'::text NOT NULL
);

-- 7. Direct Messaging
CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    user1_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user2_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    UNIQUE (user1_id, user2_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content text NOT NULL,
    is_read boolean DEFAULT false
);

-- 8. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    action_url text,
    related_id uuid,
    related_type text,
    priority text DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    is_read boolean DEFAULT false,
    is_actionable boolean DEFAULT false,
    metadata jsonb,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 9. Announcements
CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    title text NOT NULL,
    content text NOT NULL,
    posted_at timestamp with time zone DEFAULT now() NOT NULL,
    author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 10. User Skills & Experience
CREATE TABLE IF NOT EXISTS public.user_skills (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    skill_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_experience (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title text NOT NULL,
    company text NOT NULL,
    start_date date NOT NULL,
    end_date date,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 11. User Connections
CREATE TABLE IF NOT EXISTS public.user_connections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at timestamp with time zone DEFAULT now()
);

-- 12. Portfolio Items
CREATE TABLE IF NOT EXISTS public.portfolio_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    media_url text,
    media_type text,
    project_type text,
    role text,
    completion_date date,
    tags text[],
    is_featured boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Handle New User (Profile Creation)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'username', 
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Update Updated At
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_posts_updated_at ON public.posts;
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_notifications_updated_at ON public.notifications;
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update Room Member Count
CREATE OR REPLACE FUNCTION public.update_room_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.discussion_rooms SET member_count = member_count + 1 WHERE id = NEW.room_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.discussion_rooms SET member_count = GREATEST(0, member_count - 1) WHERE id = OLD.room_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_member_count_on_join ON public.room_members;
CREATE TRIGGER update_member_count_on_join AFTER INSERT ON public.room_members FOR EACH ROW EXECUTE FUNCTION public.update_room_member_count();

DROP TRIGGER IF EXISTS update_member_count_on_leave ON public.room_members;
CREATE TRIGGER update_member_count_on_leave AFTER DELETE ON public.room_members FOR EACH ROW EXECUTE FUNCTION public.update_room_member_count();

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Profiles
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Projects
CREATE POLICY "Public read access for projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Users can create projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators can update their projects" ON public.projects FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Creators can delete their projects" ON public.projects FOR DELETE USING (auth.uid() = creator_id);

-- Project Members
CREATE POLICY "Public read access for project members" ON public.project_members FOR SELECT USING (true);
CREATE POLICY "Users can join projects" ON public.project_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Project Messages
CREATE POLICY "Project members can view messages" ON public.project_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.project_members WHERE project_id = project_messages.project_id AND user_id = auth.uid())
);
CREATE POLICY "Project members can send messages" ON public.project_messages FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.project_members WHERE project_id = project_messages.project_id AND user_id = auth.uid())
);

-- Posts
CREATE POLICY "Anyone can view posts" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update their posts" ON public.posts FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Authors can delete their posts" ON public.posts FOR DELETE USING (auth.uid() = author_id);

-- Likes
CREATE POLICY "Public view likes" ON public.likes FOR SELECT USING (true);
CREATE POLICY "User manage likes" ON public.likes FOR ALL USING (auth.uid() = user_id);

-- Comments
CREATE POLICY "Public view comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "User manage comments" ON public.comments FOR ALL USING (auth.uid() = user_id);

-- Shares
CREATE POLICY "Public view shares" ON public.shares FOR SELECT USING (true);
CREATE POLICY "User manage shares" ON public.shares FOR ALL USING (auth.uid() = user_id);

-- Discussion Rooms
CREATE POLICY "Anyone can view public rooms" ON public.discussion_rooms FOR SELECT USING (is_public = true OR auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create rooms" ON public.discussion_rooms FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Creators can update rooms" ON public.discussion_rooms FOR UPDATE USING (creator_id = auth.uid());
CREATE POLICY "Creators can delete rooms" ON public.discussion_rooms FOR DELETE USING (creator_id = auth.uid());

-- Room Categories
CREATE POLICY "Anyone can view room categories" ON public.room_categories FOR SELECT USING (true);

-- Room Members
CREATE POLICY "Anyone can view room members" ON public.room_members FOR SELECT USING (true);
CREATE POLICY "Users can join rooms" ON public.room_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave rooms" ON public.room_members FOR DELETE USING (auth.uid() = user_id);

-- Room Messages
CREATE POLICY "Anyone can view room messages" ON public.room_messages FOR SELECT USING (true);
CREATE POLICY "Authenticated users can send room messages" ON public.room_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own room messages" ON public.room_messages FOR DELETE USING (auth.uid() = user_id);

-- Room Join Requests
CREATE POLICY "Users can create join requests" ON public.room_join_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Room creators can view join requests" ON public.room_join_requests FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.discussion_rooms WHERE id = room_id AND creator_id = auth.uid())
);

-- Notifications
CREATE POLICY "Users can manage their own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);

-- Announcements
CREATE POLICY "Anyone can view announcements" ON public.announcements FOR SELECT USING (true);

-- Conversations
CREATE POLICY "User manage conversations" ON public.conversations FOR ALL USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Messages
CREATE POLICY "User manage messages" ON public.messages FOR ALL USING (
    auth.uid() = sender_id OR 
    conversation_id IN (SELECT id FROM public.conversations WHERE user1_id = auth.uid() OR user2_id = auth.uid())
);

-- User Skills
CREATE POLICY "Anyone can view user skills" ON public.user_skills FOR SELECT USING (true);
CREATE POLICY "Users can manage their own skills" ON public.user_skills FOR ALL USING (auth.uid() = user_id);

-- User Experience
CREATE POLICY "Anyone can view user experience" ON public.user_experience FOR SELECT USING (true);
CREATE POLICY "Users can manage their own experience" ON public.user_experience FOR ALL USING (auth.uid() = user_id);

-- User Connections
CREATE POLICY "Authenticated can view own connections" ON public.user_connections FOR SELECT USING (follower_id = auth.uid() OR following_id = auth.uid());
CREATE POLICY "Authenticated can create connection request" ON public.user_connections FOR INSERT WITH CHECK (follower_id = auth.uid());
CREATE POLICY "Authenticated can update own connection" ON public.user_connections FOR UPDATE USING (follower_id = auth.uid());
CREATE POLICY "Authenticated can delete own connection" ON public.user_connections FOR DELETE USING (follower_id = auth.uid());

-- Portfolio Items
CREATE POLICY "Public portfolio items are viewable by everyone" ON public.portfolio_items FOR SELECT USING (true);
CREATE POLICY "Users can insert their own portfolio items" ON public.portfolio_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own portfolio items" ON public.portfolio_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own portfolio items" ON public.portfolio_items FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- DATA SEEDING
-- ============================================================================

INSERT INTO public.room_categories (name) VALUES 
('General'),
('Cinematography'),
('Directing'),
('Production'),
('Post-Production'),
('Screenwriting'),
('Sound Design'),
('Visual Effects')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('portfolios', 'portfolios', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies for portfolios
CREATE POLICY "authenticated read portfolios" ON storage.objects FOR SELECT USING (auth.role() = 'authenticated' AND bucket_id = 'portfolios');
CREATE POLICY "authenticated upload portfolios" ON storage.objects FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND bucket_id = 'portfolios');
CREATE POLICY "owner delete portfolios" ON storage.objects FOR DELETE USING (auth.role() = 'authenticated' AND bucket_id = 'portfolios' AND owner = auth.uid());

-- Storage policies for avatars
CREATE POLICY "Public can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Authenticated can upload avatars" ON storage.objects FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND bucket_id = 'avatars');
CREATE POLICY "Owners can update avatars" ON storage.objects FOR UPDATE USING (auth.role() = 'authenticated' AND bucket_id = 'avatars' AND owner = auth.uid());
CREATE POLICY "Owners can delete avatars" ON storage.objects FOR DELETE USING (auth.role() = 'authenticated' AND bucket_id = 'avatars' AND owner = auth.uid());

-- Bucket list policies
CREATE POLICY "Authenticated can list buckets" ON storage.buckets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public can list public buckets" ON storage.buckets FOR SELECT TO public USING (public = true);

-- ============================================================================
-- DONE! Your database is ready.
-- ============================================================================
