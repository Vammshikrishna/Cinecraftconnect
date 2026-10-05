-- Migration: Enable RLS, Add Policies, and Enable Realtime for project_space_bookmarks

-- 1. Enable Row Level Security
ALTER TABLE "public"."project_space_bookmarks" ENABLE ROW LEVEL SECURITY;

-- 2. Drop any existing conflicting policies
DROP POLICY IF EXISTS "Users can manage their own project space bookmarks" ON "public"."project_space_bookmarks";
DROP POLICY IF EXISTS "Users can view their own project space bookmarks" ON "public"."project_space_bookmarks";
DROP POLICY IF EXISTS "Users can insert their own project space bookmarks" ON "public"."project_space_bookmarks";
DROP POLICY IF EXISTS "Users can delete their own project space bookmarks" ON "public"."project_space_bookmarks";

-- 3. Create full management policy for authenticated users
CREATE POLICY "Users can manage their own project space bookmarks"
ON "public"."project_space_bookmarks"
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Grant table permissions
GRANT ALL ON TABLE "public"."project_space_bookmarks" TO authenticated;
GRANT ALL ON TABLE "public"."project_space_bookmarks" TO service_role;
GRANT SELECT ON TABLE "public"."project_space_bookmarks" TO anon;

-- 5. Enable REPLICA IDENTITY FULL for Realtime DELETE events
ALTER TABLE ONLY "public"."project_space_bookmarks" REPLICA IDENTITY FULL;

-- 6. Add to supabase_realtime publication if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'project_space_bookmarks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE project_space_bookmarks;
  END IF;
END $$;
