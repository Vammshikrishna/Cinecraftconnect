-- Drop existing policy if it exists to prevent query execution failure
DROP POLICY IF EXISTS "Staff can delete their own space access grants" ON "public"."space_access_grants";

-- Allow staff members to delete their own temporary space access grants (Lock Space / Revocation)
CREATE POLICY "Staff can delete their own space access grants" 
ON "public"."space_access_grants" 
FOR DELETE 
TO authenticated 
USING (
  "user_id" = auth.uid()
);
