-- Update RLS policy to allow both sender and receiver to update connection status
DROP POLICY IF EXISTS "Users can update their connections" ON public.user_connections;

CREATE POLICY "Users can update their connections"
ON public.user_connections
FOR UPDATE
USING (auth.uid() = follower_id OR auth.uid() = following_id);