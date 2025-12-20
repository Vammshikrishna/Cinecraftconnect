-- Create project_members if it doesn't exist
CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member' NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(project_id, user_id)
);

-- Enable RLS and policies for PROJECTS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public projects viewable" ON public.projects;
CREATE POLICY "Public projects viewable" ON public.projects FOR SELECT USING (is_public = true);

DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
CREATE POLICY "Users can view own projects" ON public.projects FOR ALL USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Members can view projects" ON public.projects;
CREATE POLICY "Members can view projects" ON public.projects FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.project_members 
    WHERE project_id = projects.id AND user_id = auth.uid()
  )
);

-- Enable RLS and policies for PROJECT_SPACES
ALTER TABLE public.project_spaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users view project spaces" ON public.project_spaces;
CREATE POLICY "Authenticated users view project spaces" ON public.project_spaces FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert project spaces" ON public.project_spaces;
CREATE POLICY "Users can insert project spaces" ON public.project_spaces FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own project spaces" ON public.project_spaces;
CREATE POLICY "Users can update own project spaces" ON public.project_spaces FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.projects WHERE id = project_spaces.project_id AND creator_id = auth.uid())
);

-- Ensure project_members is accessible
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View project members" ON public.project_members;
CREATE POLICY "View project members" ON public.project_members FOR SELECT TO authenticated USING (true);


-- Ensure project_space_members is accessible if it sends
CREATE TABLE IF NOT EXISTS public.project_space_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_space_id UUID REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.project_space_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View space members" ON public.project_space_members;
CREATE POLICY "View space members" ON public.project_space_members FOR SELECT TO authenticated USING (true);
