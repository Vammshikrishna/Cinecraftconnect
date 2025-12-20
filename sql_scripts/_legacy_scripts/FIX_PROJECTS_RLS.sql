-- Enable RLS on projects if not already
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 1. VIEW Policy (Select)
-- Allow everyone to view public projects
DROP POLICY IF EXISTS "Public projects are viewable by everyone" ON public.projects;
CREATE POLICY "Public projects are viewable by everyone"
ON public.projects FOR SELECT
USING (is_public = true);

-- Allow creators to view their own projects (private or public)
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
CREATE POLICY "Users can view own projects"
ON public.projects FOR SELECT
USING (auth.uid() = creator_id);

-- Allow team members to view private projects they belong to
DROP POLICY IF EXISTS "Team members can view private projects" ON public.projects;
CREATE POLICY "Team members can view private projects"
ON public.projects FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = projects.id
    AND project_members.user_id = auth.uid()
  )
);

-- 2. INSERT Policy
DROP POLICY IF EXISTS "Authenticated users can create projects" ON public.projects;
CREATE POLICY "Authenticated users can create projects"
ON public.projects FOR INSERT
WITH CHECK (auth.uid() = creator_id);

-- 3. UPDATE/DELETE Policy
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
CREATE POLICY "Users can update own projects"
ON public.projects FOR UPDATE
USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
CREATE POLICY "Users can delete own projects"
ON public.projects FOR DELETE
USING (auth.uid() = creator_id);

-- Also ensure project_members is readable
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members visible to everyone" ON public.project_members;
CREATE POLICY "Project members visible to everyone"
ON public.project_members FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can manage members of own projects" ON public.project_members;
CREATE POLICY "Users can manage members of own projects"
ON public.project_members FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_members.project_id
    AND projects.creator_id = auth.uid()
  )
);
