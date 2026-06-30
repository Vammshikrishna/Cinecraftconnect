-- Drop existing policy if it exists to prevent query execution failure
DROP POLICY IF EXISTS "Staff can view their own space access grants" ON "public"."space_access_grants";

-- Allow staff members to query/view their own temporary space access grants
CREATE POLICY "Staff can view their own space access grants" 
ON "public"."space_access_grants" 
FOR SELECT 
TO authenticated 
USING (
  "user_id" = auth.uid()
);
