-- AUDIT STEP 2 PRE-FLIGHT - READ-ONLY. Run once in the Supabase SQL editor, export the result (CSV) and paste it into the chat.
-- It changes nothing. It returns function text, key NAMES (never values), column/constraint names and file counts.
-- Columns: section | object | detail

-- 1. Foreign keys that point at profiles / auth.users and block deleting an account (no ON DELETE action, or RESTRICT).
SELECT '1_blocking_foreign_key' AS section,
       con.conrelid::regclass::text || '.' || a.attname AS object,
       'refs=' || con.confrelid::regclass::text
         || ' on_delete=' || CASE con.confdeltype WHEN 'a' THEN 'no action' WHEN 'r' THEN 'restrict' ELSE con.confdeltype::text END
         || ' column_nullable=' || (NOT a.attnotnull)::text AS detail
FROM pg_constraint con
JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
WHERE con.contype = 'f'
  AND con.confrelid IN ('public.profiles'::regclass, 'auth.users'::regclass)
  AND con.confdeltype IN ('a', 'r')

UNION ALL
-- 2. Every function that calls the push-delivery edge function (to confirm they all go through trigger_push_delivery).
SELECT '2_functions_calling_push_delivery', p.oid::regprocedure::text,
       'definer=' || p.prosecdef || ' sends_to_push_delivery=true'
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosrc ILIKE '%push-delivery%'

UNION ALL
-- 3. The live trigger_push_delivery function (checked before part_cm replaces it).
SELECT '3_trigger_push_delivery_definition', p.oid::regprocedure::text, pg_get_functiondef(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'trigger_push_delivery'

UNION ALL
-- 4. Which keys exist in app_settings (names only, NOT values).
SELECT '4_app_settings_keys', key, 'length=' || length(value)::text
FROM public.app_settings

UNION ALL
-- 5. Which tables send rows to the push webhook.
SELECT '5_push_webhook_triggers', tgrelid::regclass::text, tgname::text
FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal AND p.proname = 'trigger_push_delivery'

UNION ALL
-- 6. Storage: object counts per bucket and how many have an owner (counts only).
SELECT '6_storage_objects', bucket_id::text, 'objects=' || count(*)::text || ' with_owner=' || count(owner)::text
FROM storage.objects GROUP BY bucket_id

ORDER BY section, object, detail;
