-- Update RLS policies for vendors to allow anyone (including unauthenticated users) to select vendors
DROP POLICY IF EXISTS "Anyone can view verified vendors" ON "public"."vendors";

CREATE POLICY "Anyone can view vendors" ON "public"."vendors"
  FOR SELECT TO public USING (true);
