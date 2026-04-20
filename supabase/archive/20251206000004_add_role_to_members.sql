-- ============================================================================
-- FIX: ADD MISSING ROLE COLUMN
-- ============================================================================
-- The frontend expects a 'role' column in project_space_members, but it was missing.
-- This script adds the column with a default value of 'member'.
-- ============================================================================

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_space_members' AND column_name = 'role') THEN
        ALTER TABLE public.project_space_members 
        ADD COLUMN role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member'));
    END IF;
END $$;
