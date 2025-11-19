-- 20240731000006_consolidated_migrations.sql

-- Enable uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Create posts table
CREATE TABLE IF NOT EXISTS public.posts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public posts are viewable by everyone." ON public.posts
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own posts." ON public.posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts." ON public.posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts." ON public.posts
  FOR DELETE USING (auth.uid() = user_id);

-- Add foreign key constraints to existing tables that reference posts

-- Likes
ALTER TABLE public.likes DROP CONSTRAINT IF EXISTS fk_post_id;
ALTER TABLE public.likes
ADD CONSTRAINT fk_post_id FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;

-- Comments
ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS fk_post_id;
ALTER TABLE public.comments
ADD CONSTRAINT fk_post_id FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;

-- Shares
ALTER TABLE public.shares DROP CONSTRAINT IF EXISTS fk_post_id;
ALTER TABLE public.shares
ADD CONSTRAINT fk_post_id FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;

-- Create discussion_rooms table
CREATE TABLE IF NOT EXISTS public.discussion_rooms (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    description text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    member_count integer DEFAULT 0
);

ALTER TABLE public.discussion_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public discussion rooms are viewable by everyone." ON public.discussion_rooms
  FOR SELECT USING (true);

CREATE POLICY "Users can create discussion rooms." ON public.discussion_rooms
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    title text NOT NULL,
    content text,
    posted_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public announcements are viewable by everyone." ON public.announcements
  FOR SELECT USING (true);

CREATE POLICY "Admin can create announcements." ON public.announcements
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Add columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS full_name text,
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS about_me text,
ADD COLUMN IF NOT EXISTS craft text;
