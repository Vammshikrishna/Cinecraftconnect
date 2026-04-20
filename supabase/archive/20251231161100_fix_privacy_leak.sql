-- ============================================================================
-- FIX PRIVACY LEAK: Remove Permissive Policies
-- ============================================================================
-- The user reported seeing private projects they don't belong to.
-- This script explicitly drops all known permissive policies that might have slipped in.

-- 1. Project Spaces
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.project_spaces;
DROP POLICY IF EXISTS "Anyone can view project spaces" ON public.project_spaces;
DROP POLICY IF EXISTS "Public projects are viewable by everyone" ON public.project_spaces;

-- Ensure the strict policy exists (and replace it to be sure)
DROP POLICY IF EXISTS "View Projects" ON public.project_spaces;

CREATE POLICY "View Projects" ON public.project_spaces
FOR SELECT USING (
  -- 1. Public projects are visible to everyone
  project_space_type = 'public' 
  -- 2. Creator can see (via projects table join)
  OR auth.uid() IN (SELECT creator_id FROM public.projects WHERE id = project_spaces.project_id)
  -- 3. Members can see
  OR public.is_project_member(id)
);


-- 2. Project Space Members
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.project_space_members;
DROP POLICY IF EXISTS "Anyone can view project members" ON public.project_space_members;

-- Ensure strict member visibility (only members/creator can see the member list)
DROP POLICY IF EXISTS "View Members" ON public.project_space_members;

CREATE POLICY "View Members" ON public.project_space_members
FOR SELECT USING (
  public.is_project_member(project_space_id) 
  OR public.is_project_creator(project_space_id)
);


-- 3. Project Assets (Files, Tasks, etc.)
-- Ensure no loose policies exist here either
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.tasks;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.files;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.call_sheets;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.shot_list;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.legal_docs;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.project_messages;

-- (Re-creation of strict asset policies is handled in previous migration, 
-- but dropping 'Allow all' here acts as a safety net)
