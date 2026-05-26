SELECT
  pol.polname,
  pol.polcmd,
  pg_get_expr(pol.polqual, pol.polrelid) AS qual,
  pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check
FROM pg_policy pol
JOIN pg_class tbl ON pol.polrelid = tbl.oid
JOIN pg_namespace ns ON tbl.relnamespace = ns.oid
WHERE ns.nspname = 'public' AND tbl.relname = 'direct_messages';
