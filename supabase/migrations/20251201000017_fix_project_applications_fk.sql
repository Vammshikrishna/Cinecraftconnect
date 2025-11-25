-- Fix project_applications foreign key to reference profiles instead of auth.users
-- This allows PostgREST to correctly join project_applications with profiles

ALTER TABLE public.project_applications
DROP CONSTRAINT IF EXISTS project_applications_user_id_fkey;

ALTER TABLE public.project_applications
ADD CONSTRAINT project_applications_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;
