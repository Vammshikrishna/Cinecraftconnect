-- Add full_name column to profiles if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;

-- Add onboarding_completed column if it doesn't exist  
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

-- Add phone column if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
