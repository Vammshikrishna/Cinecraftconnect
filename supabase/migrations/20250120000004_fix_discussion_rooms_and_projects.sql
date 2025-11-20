-- Fix Discussion Rooms and Projects Features
-- This migration adds missing tables and functions for discussion rooms

-- 0. Create room_categories table if it doesn't exist (needed for foreign key)
CREATE TABLE IF NOT EXISTS public.room_categories (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    name text NOT NULL UNIQUE
);

-- Enable RLS for room_categories
ALTER TABLE public.room_categories ENABLE ROW LEVEL SECURITY;

-- Allow everyone to view categories
DROP POLICY IF EXISTS "Public can view room categories." ON public.room_categories;
CREATE POLICY "Public can view room categories." ON public.room_categories
  FOR SELECT USING (true);

-- 0.5. Create discussion_rooms table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.discussion_rooms (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    name text NOT NULL,
    description text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    is_public boolean DEFAULT true,
    member_count integer DEFAULT 0
);

-- Enable RLS for discussion_rooms
ALTER TABLE public.discussion_rooms ENABLE ROW LEVEL SECURITY;

-- 0.6. Create room_members table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.room_members (
    room_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (room_id, user_id)
);

-- Enable RLS for room_members
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

-- 1. Add missing columns to discussion_rooms table
ALTER TABLE public.discussion_rooms 
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS room_type text DEFAULT 'public',
ADD COLUMN IF NOT EXISTS project_id uuid,
ADD COLUMN IF NOT EXISTS creator_id uuid,
ADD COLUMN IF NOT EXISTS category_id uuid;

-- Add foreign key constraints separately (after columns exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'discussion_rooms_project_id_fkey'
    ) THEN
        ALTER TABLE public.discussion_rooms 
        ADD CONSTRAINT discussion_rooms_project_id_fkey 
        FOREIGN KEY (project_id) REFERENCES public.project_spaces(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'discussion_rooms_creator_id_fkey'
    ) THEN
        ALTER TABLE public.discussion_rooms 
        ADD CONSTRAINT discussion_rooms_creator_id_fkey 
        FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'discussion_rooms_category_id_fkey'
    ) THEN
        ALTER TABLE public.discussion_rooms 
        ADD CONSTRAINT discussion_rooms_category_id_fkey 
        FOREIGN KEY (category_id) REFERENCES public.room_categories(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add foreign keys to room_members
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'room_members_room_id_fkey'
    ) THEN
        ALTER TABLE public.room_members 
        ADD CONSTRAINT room_members_room_id_fkey 
        FOREIGN KEY (room_id) REFERENCES public.discussion_rooms(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'room_members_user_id_fkey'
    ) THEN
        ALTER TABLE public.room_members 
        ADD CONSTRAINT room_members_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Update existing rows to use name as title if title is null
UPDATE public.discussion_rooms SET title = name WHERE title IS NULL;

-- Make title NOT NULL after populating it
ALTER TABLE public.discussion_rooms ALTER COLUMN title SET NOT NULL;

-- Create indexes for better lookups
CREATE INDEX IF NOT EXISTS idx_discussion_rooms_project_id ON public.discussion_rooms(project_id);
CREATE INDEX IF NOT EXISTS idx_discussion_rooms_creator_id ON public.discussion_rooms(creator_id);
CREATE INDEX IF NOT EXISTS idx_discussion_rooms_category_id ON public.discussion_rooms(category_id);

-- 2. Create room_messages table for discussion room chat
CREATE TABLE IF NOT EXISTS public.room_messages (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    room_id uuid NOT NULL REFERENCES public.discussion_rooms(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    priority text DEFAULT 'normal',
    visibility_role text DEFAULT 'everyone'
);

-- Enable RLS for room_messages
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;

-- Policies for room_messages
DROP POLICY IF EXISTS "Users can view messages in rooms they are members of" ON public.room_messages;
CREATE POLICY "Users can view messages in rooms they are members of" ON public.room_messages
  FOR SELECT USING (
    -- Can view if member of the discussion room
    EXISTS (
      SELECT 1 FROM public.room_members 
      WHERE room_id = room_messages.room_id 
      AND user_id = auth.uid()
    )
    -- OR if the room is public
    OR EXISTS (
      SELECT 1 FROM public.discussion_rooms 
      WHERE id = room_messages.room_id 
      AND is_public = true
    )
    -- OR if it's a project-linked room and user is a project member
    OR EXISTS (
      SELECT 1 FROM public.discussion_rooms dr
      JOIN public.project_space_members psm ON psm.project_space_id = dr.project_id
      WHERE dr.id = room_messages.room_id 
      AND psm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert messages in rooms they are members of" ON public.room_messages;
CREATE POLICY "Users can insert messages in rooms they are members of" ON public.room_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND (
      -- Can insert if member of the discussion room
      EXISTS (
        SELECT 1 FROM public.room_members 
        WHERE room_id = room_messages.room_id 
        AND user_id = auth.uid()
      )
      -- OR if the room is public
      OR EXISTS (
        SELECT 1 FROM public.discussion_rooms 
        WHERE id = room_messages.room_id 
        AND is_public = true
      )
      -- OR if it's a project-linked room and user is a project member
      OR EXISTS (
        SELECT 1 FROM public.discussion_rooms dr
        JOIN public.project_space_members psm ON psm.project_space_id = dr.project_id
        WHERE dr.id = room_messages.room_id 
        AND psm.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete their own messages" ON public.room_messages;
CREATE POLICY "Users can delete their own messages" ON public.room_messages
  FOR DELETE USING (auth.uid() = user_id);

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
  FOR UPDATE USING (creator_id = auth.uid());

DROP POLICY IF EXISTS "Room creators can delete their own rooms." ON public.discussion_rooms;
CREATE POLICY "Room creators can delete their own rooms." ON public.discussion_rooms
  FOR DELETE USING (creator_id = auth.uid());

-- Policies for room_members
DROP POLICY IF EXISTS "Users can see the members of rooms they are in." ON public.room_members;
CREATE POLICY "Users can see the members of rooms they are in." ON public.room_members
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.room_members WHERE room_id = room_members.room_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can join and leave rooms." ON public.room_members;
CREATE POLICY "Users can join and leave rooms." ON public.room_members
  FOR ALL USING (user_id = auth.uid());

-- 3. Create RPC function to create discussion room with creator as member
CREATE OR REPLACE FUNCTION public.create_discussion_room_with_creator(
    c_id uuid,
    cat_id uuid,
    room_title text,
    room_description text,
    type text,
    room_tags text[]
)
RETURNS uuid AS $$
DECLARE
    new_room_id uuid;
BEGIN
    -- Insert the new discussion room
    INSERT INTO public.discussion_rooms (
        title,
        name,
        description,
        category_id,
        creator_id,
        room_type,
        is_public,
        member_count
    ) VALUES (
        room_title,
        room_title,  -- Also set name for backward compatibility
        room_description,
        cat_id,
        c_id,
        type,
        CASE WHEN type = 'public' THEN true ELSE false END,
        1  -- Creator is the first member
    )
    RETURNING id INTO new_room_id;

    -- Add creator as a member
    INSERT INTO public.room_members (room_id, user_id)
    VALUES (new_room_id, c_id);

    RETURN new_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create trigger to update member_count when members join/leave
CREATE OR REPLACE FUNCTION public.update_room_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.discussion_rooms
        SET member_count = member_count + 1
        WHERE id = NEW.room_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.discussion_rooms
        SET member_count = GREATEST(0, member_count - 1)
        WHERE id = OLD.room_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_member_count_on_join ON public.room_members;
CREATE TRIGGER update_member_count_on_join
    AFTER INSERT ON public.room_members
    FOR EACH ROW
    EXECUTE FUNCTION public.update_room_member_count();

DROP TRIGGER IF EXISTS update_member_count_on_leave ON public.room_members;
CREATE TRIGGER update_member_count_on_leave
    AFTER DELETE ON public.room_members
    FOR EACH ROW
    EXECUTE FUNCTION public.update_room_member_count();

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_room_messages_room_id ON public.room_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_room_messages_created_at ON public.room_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON public.room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON public.room_members(user_id);

-- 6. Insert default room categories if they don't exist
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
