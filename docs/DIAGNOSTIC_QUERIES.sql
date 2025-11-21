-- Diagnostic queries to verify RLS policies are correctly applied

-- 1. Check all policies on posts table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'posts'
ORDER BY policyname;

-- 2. Check all policies on discussion_rooms table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'discussion_rooms'
ORDER BY policyname;

-- 3. Check all policies on room_members table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'room_members'
ORDER BY policyname;

-- 4. Check all policies on project_spaces table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'project_spaces'
ORDER BY policyname;

-- 5. Check all policies on profiles table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 6. Test if current user can view posts
SELECT COUNT(*) as post_count FROM posts;

-- 7. Test if current user can view profiles
SELECT COUNT(*) as profile_count FROM profiles;

-- 8. Test if current user can view discussion_rooms
SELECT COUNT(*) as room_count FROM discussion_rooms;
