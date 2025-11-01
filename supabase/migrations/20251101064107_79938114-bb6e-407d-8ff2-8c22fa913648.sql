-- Phase 1: Complete Database Schema Restructuring for Project-Linked Discussion Rooms

-- 1.1 Link discussion rooms to projects
ALTER TABLE public.discussion_rooms 
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS room_purpose TEXT DEFAULT 'general';

-- Add unique constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_project_room'
  ) THEN
    ALTER TABLE public.discussion_rooms ADD CONSTRAINT unique_project_room UNIQUE (project_id);
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_discussion_rooms_project_id ON public.discussion_rooms(project_id);

-- 1.2 Enhance room_messages table
ALTER TABLE public.room_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS visibility_role TEXT DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_type TEXT;

-- Drop existing constraints if they exist
ALTER TABLE public.room_messages DROP CONSTRAINT IF EXISTS room_messages_message_type_check;
ALTER TABLE public.room_messages DROP CONSTRAINT IF EXISTS room_messages_priority_check;
ALTER TABLE public.room_messages DROP CONSTRAINT IF EXISTS room_messages_visibility_role_check;
ALTER TABLE public.room_messages DROP CONSTRAINT IF EXISTS room_messages_media_type_check;
ALTER TABLE public.room_messages DROP CONSTRAINT IF EXISTS message_content_length;

-- Add new constraints
ALTER TABLE public.room_messages
  ADD CONSTRAINT room_messages_message_type_check CHECK (message_type IN ('text', 'file', 'image', 'system')),
  ADD CONSTRAINT room_messages_priority_check CHECK (priority IN ('normal', 'high', 'critical')),
  ADD CONSTRAINT room_messages_visibility_role_check CHECK (visibility_role IN ('all', 'admin', 'moderator', 'creator')),
  ADD CONSTRAINT room_messages_media_type_check CHECK (media_type IS NULL OR media_type IN ('image', 'video', 'file', 'audio')),
  ADD CONSTRAINT message_content_length CHECK (length(content) > 0 AND length(content) <= 2000);

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_room_messages_priority ON public.room_messages(priority, created_at DESC);

-- 1.3 Create room_calls table
CREATE TABLE IF NOT EXISTS public.room_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.discussion_rooms(id) ON DELETE CASCADE,
  started_by UUID NOT NULL REFERENCES auth.users(id),
  call_type TEXT NOT NULL CHECK (call_type IN ('audio', 'video')),
  is_active BOOLEAN DEFAULT true,
  participant_count INTEGER DEFAULT 1,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.room_calls ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Room members can view calls" ON public.room_calls;
DROP POLICY IF EXISTS "Room members can start calls" ON public.room_calls;
DROP POLICY IF EXISTS "Call creators can update calls" ON public.room_calls;

-- Create RLS policies for calls
CREATE POLICY "Room members can view calls" ON public.room_calls
  FOR SELECT USING (
    room_id IN (
      SELECT room_id FROM public.room_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Room members can start calls" ON public.room_calls
  FOR INSERT WITH CHECK (
    auth.uid() = started_by AND
    room_id IN (SELECT room_id FROM public.room_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Call creators can update calls" ON public.room_calls
  FOR UPDATE USING (auth.uid() = started_by);

-- 1.4 Create call_participants table
CREATE TABLE IF NOT EXISTS public.call_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.room_calls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  left_at TIMESTAMP WITH TIME ZONE,
  is_audio_enabled BOOLEAN DEFAULT true,
  is_video_enabled BOOLEAN DEFAULT true,
  UNIQUE(call_id, user_id)
);

-- Enable RLS
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Participants can view call participants" ON public.call_participants;

-- Create RLS policy
CREATE POLICY "Participants can view call participants" ON public.call_participants
  FOR SELECT USING (
    call_id IN (
      SELECT id FROM public.room_calls 
      WHERE room_id IN (
        SELECT room_id FROM public.room_members WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can join calls" ON public.call_participants;

CREATE POLICY "Users can join calls" ON public.call_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their participation" ON public.call_participants;

CREATE POLICY "Users can update their participation" ON public.call_participants
  FOR UPDATE USING (auth.uid() = user_id);

-- 1.5 Update room_members role constraint
ALTER TABLE public.room_members DROP CONSTRAINT IF EXISTS room_members_role_check;
ALTER TABLE public.room_members ADD CONSTRAINT room_members_role_check 
  CHECK (role IN ('creator', 'admin', 'moderator', 'member'));

-- 1.6 Create trigger function for auto-creating discussion room
CREATE OR REPLACE FUNCTION public.create_project_discussion_room()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_room_id UUID;
BEGIN
  -- Create the discussion room
  INSERT INTO public.discussion_rooms (
    title,
    description,
    creator_id,
    project_id,
    room_purpose,
    room_type
  ) VALUES (
    NEW.title || ' - Discussion Room',
    'Collaboration space for ' || NEW.title,
    NEW.creator_id,
    NEW.id,
    'project',
    'private'
  ) RETURNING id INTO new_room_id;

  -- Add creator as admin member
  INSERT INTO public.room_members (
    room_id,
    user_id,
    role
  ) VALUES (
    new_room_id,
    NEW.creator_id,
    'creator'
  );

  -- Create a welcome message
  INSERT INTO public.room_messages (
    room_id,
    user_id,
    content,
    message_type,
    priority
  ) VALUES (
    new_room_id,
    NEW.creator_id,
    'Welcome to the discussion room for ' || NEW.title || '! Use this space to collaborate with your team.',
    'system',
    'normal'
  );

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS project_create_room_trigger ON public.projects;
CREATE TRIGGER project_create_room_trigger
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.create_project_discussion_room();

-- 1.7 Update RLS policies for messages with visibility
DROP POLICY IF EXISTS "Room members can view messages" ON public.room_messages;
DROP POLICY IF EXISTS "Room members can view messages based on visibility" ON public.room_messages;

CREATE POLICY "Room members can view messages based on visibility" ON public.room_messages
  FOR SELECT USING (
    room_id IN (
      SELECT rm.room_id 
      FROM public.room_members rm
      WHERE rm.user_id = auth.uid()
    )
    AND (
      visibility_role = 'all' OR
      (visibility_role = 'admin' AND EXISTS (
        SELECT 1 FROM public.room_members 
        WHERE room_id = room_messages.room_id 
        AND user_id = auth.uid() 
        AND role IN ('admin', 'creator')
      )) OR
      (visibility_role = 'moderator' AND EXISTS (
        SELECT 1 FROM public.room_members 
        WHERE room_id = room_messages.room_id 
        AND user_id = auth.uid() 
        AND role IN ('admin', 'moderator', 'creator')
      )) OR
      (visibility_role = 'creator' AND EXISTS (
        SELECT 1 FROM public.room_members 
        WHERE room_id = room_messages.room_id 
        AND user_id = auth.uid() 
        AND role = 'creator'
      ))
    )
  );