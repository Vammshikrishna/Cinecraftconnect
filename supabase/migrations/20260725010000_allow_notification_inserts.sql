-- Allow authenticated users to create notifications for other users
-- This is necessary for things like pitching, where a producer takes an action
-- that generates a notification for the writer.

CREATE POLICY "Authenticated users can create notifications"
ON "public"."notifications"
FOR INSERT
TO authenticated
WITH CHECK (true);
