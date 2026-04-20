-- ============================================================================
-- FIX: RENAME COMMENTS TO POST_COMMENTS
-- ============================================================================
-- The frontend expects 'post_comments', but the database has 'comments'.
-- This script renames the table and updates RLS policies.
-- ============================================================================

BEGIN;

-- 1. Rename Table (if 'comments' exists and 'post_comments' does not)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'comments') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'post_comments') THEN
        ALTER TABLE public.comments RENAME TO post_comments;
    END IF;
END $$;

-- 2. Enable RLS
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- 3. Update Policies (Drop old ones if they exist on the new table name, add new ones)
DROP POLICY IF EXISTS "Auth View Comments" ON public.post_comments;
DROP POLICY IF EXISTS "Auth Create Comments" ON public.post_comments;
DROP POLICY IF EXISTS "Owner Manage Comments" ON public.post_comments;
DROP POLICY IF EXISTS "Public View Comments" ON public.post_comments;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.post_comments;

CREATE POLICY "Auth View Comments" ON public.post_comments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Create Comments" ON public.post_comments FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);
CREATE POLICY "Owner Manage Comments" ON public.post_comments FOR ALL USING (auth.uid() = user_id);

-- 4. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;

COMMIT;
