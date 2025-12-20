-- Check if the specific user exists in profiles
SELECT * FROM public.profiles WHERE id = 'cef79cff-21d5-47dc-8d73-b4d883d3ee66';

-- Check RLS policies on posts
SELECT * FROM pg_policies WHERE tablename = 'posts';

-- Insert profile if missing (SAFE UPSERT)
INSERT INTO public.profiles (id, username, full_name, onboarding_completed, craft)
VALUES (
    'cef79cff-21d5-47dc-8d73-b4d883d3ee66', 
    'troubleshoot_user', 
    'Troubleshooting User', 
    true, 
    'Editor'
) ON CONFLICT (id) DO NOTHING;

-- Temporarily DISABLE RLS on posts to verify if that breaks the loop
ALTER TABLE public.posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
