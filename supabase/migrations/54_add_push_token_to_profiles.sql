-- Add push_token column to public.profiles if it does not already exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token text;
