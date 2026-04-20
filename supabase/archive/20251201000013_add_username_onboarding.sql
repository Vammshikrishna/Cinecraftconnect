-- Add username and onboarding_completed columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- Add constraint to ensure username is lowercase and valid format
ALTER TABLE public.profiles 
ADD CONSTRAINT username_format CHECK (username ~ '^[a-z0-9_]{3,20}$');
