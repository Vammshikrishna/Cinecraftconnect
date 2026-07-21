-- Drop old text-comparison staff policies
DROP POLICY IF EXISTS "Staff with active grants can read group keys" ON "public"."group_keys";
DROP POLICY IF EXISTS "Staff with active grants can insert group keys" ON "public"."group_keys";
DROP POLICY IF EXISTS "Staff with active grants can update group keys" ON "public"."group_keys";

-- Recreate with native UUID casting
CREATE POLICY "Staff with active grants can read group keys" 
ON "public"."group_keys" 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM "public"."space_access_grants" 
    WHERE "space_access_grants"."user_id" = auth.uid() 
    AND "space_access_grants"."target_id"::uuid = "group_keys"."target_id" 
    AND "space_access_grants"."expires_at" > now()
  )
);

CREATE POLICY "Staff with active grants can insert group keys" 
ON "public"."group_keys" 
FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "public"."space_access_grants" 
    WHERE "space_access_grants"."user_id" = auth.uid() 
    AND "space_access_grants"."target_id"::uuid = "group_keys"."target_id" 
    AND "space_access_grants"."expires_at" > now()
  )
);

CREATE POLICY "Staff with active grants can update group keys" 
ON "public"."group_keys" 
FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM "public"."space_access_grants" 
    WHERE "space_access_grants"."user_id" = auth.uid() 
    AND "space_access_grants"."target_id"::uuid = "group_keys"."target_id" 
    AND "space_access_grants"."expires_at" > now()
  )
) 
WITH CHECK (true);
