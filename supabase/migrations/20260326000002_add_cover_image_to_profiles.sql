-- Migration: 20260326000002_add_cover_image_to_profiles.sql

-- Add cover_image_url to profiles table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'cover_image_url'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN cover_image_url TEXT;
    END IF;
END $$;
