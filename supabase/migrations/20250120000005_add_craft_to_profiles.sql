-- Add craft column to profiles table for user's profession/role
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS craft text;

-- Add index for craft column for filtering
CREATE INDEX IF NOT EXISTS idx_profiles_craft ON public.profiles(craft);

-- Add comment
COMMENT ON COLUMN public.profiles.craft IS 'User''s profession or role in the film industry (e.g., Director, Cinematographer, Editor)';
