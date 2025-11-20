-- Add full_name column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS full_name text;

-- Optionally, you can set a default or update existing rows
-- UPDATE public.profiles SET full_name = COALESCE(username, email) WHERE full_name IS NULL;

COMMENT ON COLUMN public.profiles.full_name IS 'User full name for display';
