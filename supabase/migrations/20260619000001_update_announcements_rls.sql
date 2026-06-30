-- Update RLS policies for announcements to allow anyone (including unauthenticated users) to select announcements
DROP POLICY IF EXISTS "Auth View Announcements" ON "public"."announcements";

CREATE POLICY "Anyone can view announcements" ON "public"."announcements"
  FOR SELECT TO public USING (true);
