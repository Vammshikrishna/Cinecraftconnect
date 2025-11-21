-- Check and verify RLS policies for posts and profiles tables

-- 1. Check if posts table has RLS enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'posts';

-- 2. List all policies on posts table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'posts'
ORDER BY policyname;

-- 3. Check if profiles table has RLS enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'profiles';

-- 4. List all policies on profiles table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 5. Test if current user can SELECT from posts
SELECT COUNT(*) as can_select_posts FROM posts;

-- 6. Test if current user can SELECT from profiles  
SELECT COUNT(*) as can_select_profiles FROM profiles;

-- 7. Check foreign key from posts.author_id to profiles
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'posts' 
  AND tc.constraint_type = 'FOREIGN KEY';
