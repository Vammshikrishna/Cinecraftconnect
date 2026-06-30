-- Drop existing policies if they exist to prevent query execution failure
DROP POLICY IF EXISTS "Users can read their own group keys" ON "public"."group_keys";
DROP POLICY IF EXISTS "Users can update group keys" ON "public"."group_keys";
DROP POLICY IF EXISTS "Staff with active grants can read group keys" ON "public"."group_keys";
DROP POLICY IF EXISTS "Staff with active grants can insert group keys" ON "public"."group_keys";
DROP POLICY IF EXISTS "Staff with active grants can update group keys" ON "public"."group_keys";

-- Allow users to read their own group keys directly
CREATE POLICY "Users can read their own group keys" 
ON "public"."group_keys" 
FOR SELECT 
TO authenticated 
USING ("user_id" = auth.uid());

-- Allow users to update their own group keys, or members to update keys of others in the same space/room (essential for upsert)
CREATE POLICY "Users can update group keys" 
ON "public"."group_keys" 
FOR UPDATE 
TO authenticated 
USING (
  "user_id" = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM "public"."room_members" 
    WHERE "room_members"."room_id" = "group_keys"."target_id" 
    AND "room_members"."user_id" = auth.uid()
  ) 
  OR EXISTS (
    SELECT 1 FROM "public"."project_space_members" 
    WHERE "project_space_members"."project_space_id" = "group_keys"."target_id" 
    AND "project_space_members"."user_id" = auth.uid()
  )
) 
WITH CHECK (true);

-- Allow staff with active escalated access grants to read keys of the audited space
CREATE POLICY "Staff with active grants can read group keys" 
ON "public"."group_keys" 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM "public"."space_access_grants" 
    WHERE "space_access_grants"."user_id" = auth.uid() 
    AND "space_access_grants"."target_id" = "group_keys"."target_id"::text 
    AND "space_access_grants"."expires_at" > now()
  )
);

-- Allow staff with active escalated access grants to insert keys of the audited space
CREATE POLICY "Staff with active grants can insert group keys" 
ON "public"."group_keys" 
FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "public"."space_access_grants" 
    WHERE "space_access_grants"."user_id" = auth.uid() 
    AND "space_access_grants"."target_id" = "group_keys"."target_id"::text 
    AND "space_access_grants"."expires_at" > now()
  )
);

-- Allow staff with active escalated access grants to update keys of the audited space
CREATE POLICY "Staff with active grants can update group keys" 
ON "public"."group_keys" 
FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM "public"."space_access_grants" 
    WHERE "space_access_grants"."user_id" = auth.uid() 
    AND "space_access_grants"."target_id" = "group_keys"."target_id"::text 
    AND "space_access_grants"."expires_at" > now()
  )
) 
WITH CHECK (true);
