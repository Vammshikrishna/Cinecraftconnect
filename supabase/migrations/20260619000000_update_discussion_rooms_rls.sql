-- Update RLS policies for discussion_rooms to allow anyone (including unauthenticated users) to select room metadata
DROP POLICY IF EXISTS "Anyone can view public rooms" ON "public"."discussion_rooms";
DROP POLICY IF EXISTS "Auth View Public Rooms" ON "public"."discussion_rooms";

CREATE POLICY "Anyone can view discussion rooms" ON "public"."discussion_rooms"
  FOR SELECT TO public USING (true);
