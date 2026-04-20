-- Add account_type column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_type text;
