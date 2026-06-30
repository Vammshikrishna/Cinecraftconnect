-- Enable RLS for calls table
ALTER TABLE "public"."calls" ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view calls
CREATE POLICY "Allow authenticated users to select calls"
ON "public"."calls" FOR SELECT
USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert calls
CREATE POLICY "Allow authenticated users to insert calls"
ON "public"."calls" FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update calls
CREATE POLICY "Allow authenticated users to update calls"
ON "public"."calls" FOR UPDATE
USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete calls (optional but good for cleanup)
CREATE POLICY "Allow authenticated users to delete calls"
ON "public"."calls" FOR DELETE
USING (auth.role() = 'authenticated');

-- Enable RLS for call_participants table
ALTER TABLE "public"."call_participants" ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view call participants
CREATE POLICY "Allow authenticated users to select call participants"
ON "public"."call_participants" FOR SELECT
USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert call participants
CREATE POLICY "Allow authenticated users to insert call participants"
ON "public"."call_participants" FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update call participants
CREATE POLICY "Allow authenticated users to update call participants"
ON "public"."call_participants" FOR UPDATE
USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete call participants
CREATE POLICY "Allow authenticated users to delete call participants"
ON "public"."call_participants" FOR DELETE
USING (auth.role() = 'authenticated');
