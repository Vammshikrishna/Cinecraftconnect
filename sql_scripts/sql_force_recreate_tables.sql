-- Drop existing tables to ensure clean state
DROP TABLE IF EXISTS public.project_messages CASCADE;
DROP TABLE IF EXISTS public.project_members CASCADE;
DROP TABLE IF EXISTS public.project_spaces CASCADE;
DROP TABLE IF EXISTS public.room_messages CASCADE;
DROP TABLE IF EXISTS public.room_members CASCADE;
-- Do NOT drop projects table if it has data you want to keep, but for this fix we assume schema is broken
-- DROP TABLE IF EXISTS public.projects CASCADE; 

-- Ensure projects table exists (if not, create it)
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

-- Enable RLS on projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Policies for projects
DROP POLICY IF EXISTS "Public read access for projects" ON public.projects;
CREATE POLICY "Public read access for projects" ON public.projects FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
CREATE POLICY "Users can create projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Creators can update their projects" ON public.projects;
CREATE POLICY "Creators can update their projects" ON public.projects FOR UPDATE USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Creators can delete their projects" ON public.projects;
CREATE POLICY "Creators can delete their projects" ON public.projects FOR DELETE USING (auth.uid() = creator_id);


-- Create project_spaces table
CREATE TABLE public.project_spaces (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(project_id)
);

-- Create project_members table
CREATE TABLE public.project_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member' NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(project_id, user_id)
);

-- Create room_members table
CREATE TABLE public.room_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES public.discussion_rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member' NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(room_id, user_id)
);

-- Create project_messages table
CREATE TABLE public.project_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create room_messages table
CREATE TABLE public.room_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES public.discussion_rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS for new tables
ALTER TABLE public.project_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;

-- Policies for project_spaces
CREATE POLICY "Public read access for project spaces" ON public.project_spaces FOR SELECT USING (true);

CREATE POLICY "Project members can view spaces" ON public.project_spaces FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.project_members WHERE project_id = project_spaces.project_id AND user_id = auth.uid())
);

-- Policies for project_members
CREATE POLICY "Public read access for project members" ON public.project_members FOR SELECT USING (true);
CREATE POLICY "Users can join projects" ON public.project_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for room_members
CREATE POLICY "Public read access for room members" ON public.room_members FOR SELECT USING (true);
CREATE POLICY "Users can join rooms" ON public.room_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for project_messages
CREATE POLICY "Project members can view messages" ON public.project_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.project_members WHERE project_id = project_messages.project_id AND user_id = auth.uid())
);
CREATE POLICY "Project members can send messages" ON public.project_messages FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.project_members WHERE project_id = project_messages.project_id AND user_id = auth.uid())
);

-- Policies for room_messages
CREATE POLICY "Room members can view messages" ON public.room_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.room_members WHERE room_id = room_messages.room_id AND user_id = auth.uid())
);
CREATE POLICY "Room members can send messages" ON public.room_messages FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.room_members WHERE room_id = room_messages.room_id AND user_id = auth.uid())
);
