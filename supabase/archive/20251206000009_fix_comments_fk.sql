-- ============================================================================
-- FIX: POST COMMENTS FOREIGN KEY TO PROFILES
-- ============================================================================
-- The frontend needs to join 'post_comments' with 'profiles'.
-- Currently, 'post_comments' references 'auth.users', which PostgREST cannot use for joins.
-- This script changes the FK to reference 'public.profiles'.
-- ============================================================================

BEGIN;

-- 1. Drop existing FK to auth.users (if it exists)
-- We need to find the constraint name. It's usually 'comments_user_id_fkey' or similar.
-- We'll try to drop common names or use a DO block to find it.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'post_comments' 
        AND constraint_type = 'FOREIGN KEY'
    ) LOOP
        -- Check if this constraint points to auth.users (we can't easily check target in simple SQL without joining system tables)
        -- But we know we want to replace the user_id FK.
        -- Let's just drop the constraint on user_id.
        
        -- Actually, safer to just ADD the new one if we can't easily identify the old one.
        -- But duplicate FKs on same column are messy.
        NULL;
    END LOOP;
END $$;

-- Let's explicitly drop the likely name from fresh_init
ALTER TABLE public.post_comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey;
ALTER TABLE public.post_comments DROP CONSTRAINT IF EXISTS post_comments_user_id_fkey;

-- 2. Add new FK to public.profiles
ALTER TABLE public.post_comments
ADD CONSTRAINT post_comments_user_id_fkey_profiles
FOREIGN KEY (user_id) REFERENCES public.profiles(id)
ON DELETE CASCADE;

COMMIT;
