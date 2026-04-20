-- Clean up all application data
-- This migration removes all test data to provide a fresh start

-- 1. Truncate content tables (CASCADE handles dependent tables like tasks, messages, etc.)
TRUNCATE TABLE public.project_spaces CASCADE;
TRUNCATE TABLE public.discussion_rooms CASCADE;
TRUNCATE TABLE public.posts CASCADE;
TRUNCATE TABLE public.user_connections CASCADE;
TRUNCATE TABLE public.notifications CASCADE;
TRUNCATE TABLE public.conversations CASCADE;
TRUNCATE TABLE public.announcements CASCADE;

-- 2. Delete all users (This will cascade to profiles and any remaining user-linked data)
-- Note: This requires the migration to run with sufficient privileges (which local Supabase migrations do)
DELETE FROM auth.users;

-- 3. Clean up storage objects (Optional, but good for a full reset)
-- We delete objects from specific buckets used by the app
DELETE FROM storage.objects 
WHERE bucket_id IN ('project-files', 'call-sheets', 'legal-docs', 'avatars', 'post-media');
