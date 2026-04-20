-- ============================================================================
-- FIX SOCIAL FEATURES (Likes & Connections)
-- ============================================================================
-- The user reported issues with Likes and Network (Connect Requests).
-- This likely stems from missing or restrictive RLS policies on these tables.

-- 1. POST LIKES
-- Allow users to like posts and remove their likes.
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can like posts" ON public.post_likes;
DROP POLICY IF EXISTS "Users can unlike posts" ON public.post_likes;
DROP POLICY IF EXISTS "View post likes" ON public.post_likes;
DROP POLICY IF EXISTS "manage_own_likes" ON public.post_likes;

CREATE POLICY "manage_own_likes" ON public.post_likes
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "view_all_likes" ON public.post_likes
FOR SELECT
TO authenticated
USING (true);


-- 2. USER CONNECTIONS (Network)
-- Allow users to manage connections where they are the follower or following.
ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage Own Connections" ON public.user_connections;
DROP POLICY IF EXISTS "view_connections" ON public.user_connections;
DROP POLICY IF EXISTS "manage_connections" ON public.user_connections;

-- View: I can see connections I sent or received
CREATE POLICY "view_connections" ON public.user_connections
FOR SELECT
TO authenticated
USING (
    follower_id = auth.uid() OR following_id = auth.uid()
);

-- Insert: I can send a request (I am the follower)
CREATE POLICY "create_connection_request" ON public.user_connections
FOR INSERT
TO authenticated
WITH CHECK (
    follower_id = auth.uid()
);

-- Update: I can accept requests (I am the following) OR cancel/update my requests
CREATE POLICY "update_connection_request" ON public.user_connections
FOR UPDATE
TO authenticated
USING (
    following_id = auth.uid() OR follower_id = auth.uid()
)
WITH CHECK (
    following_id = auth.uid() OR follower_id = auth.uid()
);

-- Delete: I can cancel/remove connections
CREATE POLICY "delete_connection" ON public.user_connections
FOR DELETE
TO authenticated
USING (
    following_id = auth.uid() OR follower_id = auth.uid()
);
