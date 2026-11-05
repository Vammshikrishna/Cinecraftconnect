-- PART CN - find a user's uploaded files by owner (audit step 2b)
-- Run in the Supabase SQL editor. Needed by the new delete-account function so that deleting an account removes the
-- files from EVERY bucket (the old version only looked in three buckets). Nothing changes until the function is called.
-- Only the service key (the edge function) can run it; signed-in users and the public key cannot.

CREATE OR REPLACE FUNCTION public.list_user_storage_objects(p_user uuid)
 RETURNS TABLE(bucket_id text, name text)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'storage', 'pg_temp'
AS $function$
  SELECT o.bucket_id::text, o.name::text
  FROM storage.objects o
  WHERE o.owner = p_user
  LIMIT 100000;
$function$;

REVOKE ALL ON FUNCTION public.list_user_storage_objects(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_user_storage_objects(uuid) TO service_role;
