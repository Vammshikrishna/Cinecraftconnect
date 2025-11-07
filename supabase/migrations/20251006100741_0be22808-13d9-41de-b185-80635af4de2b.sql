-- Add foreign key constraint to link projects.creator_id to profiles.id
-- ALTER TABLE public.projects 
-- ADD CONSTRAINT projects_creator_id_fkey 
-- FOREIGN KEY (creator_id) 
-- REFERENCES public.profiles(id) 
-- ON DELETE CASCADE;

-- Add index on creator_id for better query performance
-- CREATE INDEX IF NOT EXISTS idx_projects_creator_id 
-- ON public.projects(creator_id);