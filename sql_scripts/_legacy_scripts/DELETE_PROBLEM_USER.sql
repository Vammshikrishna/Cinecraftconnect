-- DELETE THE PROBLEMATIC USER TO RESET STATE
-- Replace the UUID below with the one from your logs if different
BEGIN;
  -- Delete from profiles (if constraints exist)
  DELETE FROM public.profiles WHERE id = 'cef79cff-21d5-47dc-8d73-b4d883d3ee66';
  
  -- Delete from Auth Users (This is the important one)
  -- Note: You usually cannot run this from SQL Editor on hosted Supabase for security.
  -- You must use the Supabase Dashboard > Authentication > Users list.
  
  -- However, we can try to clean up related data first
  DELETE FROM public.posts WHERE author_id = 'cef79cff-21d5-47dc-8d73-b4d883d3ee66';
  DELETE FROM public.user_film_ratings WHERE user_id = 'cef79cff-21d5-47dc-8d73-b4d883d3ee66';
COMMIT;

-- INSTRUCTIONS:
-- 1. Run this script to clean up data.
-- 2. Go to Supabase Dashboard -> Authentication -> Users.
-- 3. Find 'cef79cff-21d5-47dc-8d73-b4d883d3ee66' (or email associated).
-- 4. Click "Delete User".
-- 5. Sign Up again in the app.
