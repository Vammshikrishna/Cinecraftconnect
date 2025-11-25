-- Migration: Create user_connections table and RLS policies
-- Create table to store connections between users
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS user_connections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE user_connections ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can SELECT rows where they are involved
CREATE POLICY "Authenticated can view own connections"
ON user_connections FOR SELECT
TO authenticated
USING ( follower_id = auth.uid() OR following_id = auth.uid() );

-- Policy: Authenticated users can INSERT a new connection (request)
CREATE POLICY "Authenticated can create connection request"
ON user_connections FOR INSERT
TO authenticated
WITH CHECK ( follower_id = auth.uid() );

-- Policy: Authenticated users can UPDATE status of a connection they own (i.e., where they are follower)
CREATE POLICY "Authenticated can update own connection"
ON user_connections FOR UPDATE
TO authenticated
USING ( follower_id = auth.uid() )
WITH CHECK ( follower_id = auth.uid() );

-- Policy: Authenticated users can DELETE a connection they own
CREATE POLICY "Authenticated can delete own connection"
ON user_connections FOR DELETE
TO authenticated
USING ( follower_id = auth.uid() );
