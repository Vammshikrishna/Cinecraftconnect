-- Check existing buckets
SELECT id, name, public, owner, created_at, updated_at
FROM storage.buckets;

-- Check RLS policies on storage.objects
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage';
