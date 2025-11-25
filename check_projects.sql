-- Check if projects table exists and has data
SELECT COUNT(*) as project_count FROM projects;

-- Check RLS policies on projects table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'projects';

-- Get sample projects if they exist
SELECT id, title, description, status, creator_id, created_at 
FROM projects 
LIMIT 5;
