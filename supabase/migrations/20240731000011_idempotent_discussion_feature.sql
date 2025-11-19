-- 20240731000011_idempotent_discussion_feature.sql

-- Enable uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Create room_categories table
CREATE TABLE IF NOT EXISTS public.room_categories (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    name text NOT NULL UNIQUE
);

-- Create discussion_rooms table
CREATE TABLE IF NOT EXISTS public.discussion_rooms (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    name text NOT NULL,
    description text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    is_public boolean DEFAULT true,
    member_count integer DEFAULT 0,
    category_id uuid REFERENCES public.room_categories(id) ON DELETE SET NULL
);

-- Create room_members table
CREATE TABLE IF NOT EXISTS public.room_members (
    room_id uuid REFERENCES public.discussion_rooms(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    joined_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (room_id, user_id)
);

-- Enable Row Level Security for room_categories
ALTER TABLE public.room_categories ENABLE ROW LEVEL SECURITY;

-- Policies for room_categories
DROP POLICY IF EXISTS "Public can view room categories." ON public.room_categories;
CREATE POLICY "Public can view room categories." ON public.room_categories
  FOR SELECT USING (true);

-- Enable Row Level Security for discussion_rooms
ALTER TABLE public.discussion_rooms ENABLE ROW LEVEL SECURITY;

-- Policies for discussion_rooms
DROP POLICY IF EXISTS "Users can create discussion rooms." ON public.discussion_rooms;
CREATE POLICY "Users can create discussion rooms." ON public.discussion_rooms
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view public discussion rooms." ON public.discussion_rooms;
CREATE POLICY "Users can view public discussion rooms." ON public.discussion_rooms
  FOR SELECT USING (is_public = true);

DROP POLICY IF EXISTS "Users can view private discussion rooms they are a member of." ON public.discussion_rooms;
CREATE POLICY "Users can view private discussion rooms they are a member of." ON public.discussion_rooms
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.room_members WHERE room_id = id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "Room creators can update their own rooms." ON public.discussion_rooms;
CREATE POLICY "Room creators can update their own rooms." ON public.discussion_rooms
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.room_members WHERE room_id = id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "Room creators can delete their own rooms." ON public.discussion_rooms;
CREATE POLICY "Room creators can delete their own rooms." ON public.discussion_rooms
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.room_members WHERE room_id = id AND user_id = auth.uid()));

-- Enable Row Level Security for room_members
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

-- Policies for room_members
DROP POLICY IF EXISTS "Users can see the members of rooms they are in." ON public.room_members;
CREATE POLICY "Users can see the members of rooms they are in." ON public.room_members
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.room_members WHERE room_id = room_members.room_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can join and leave rooms." ON public.room_members;
CREATE POLICY "Users can join and leave rooms." ON public.room_members
  FOR ALL USING (user_id = auth.uid());
