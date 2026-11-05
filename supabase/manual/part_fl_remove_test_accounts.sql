-- PART FL - remove the automated TEST accounts (cctest.*@example.com) and everything they made. Run ONLY after the testing agents have finished.
--
-- WHY: the browser tests created real accounts in this project (fan / creator / studio, plus a few leftovers) and they posted, applied, listed jobs and so on.
-- Those jobs, posts and profiles are visible to real users until they are removed. The addresses end in @example.com, a reserved domain nobody owns,
-- and all start with "cctest." so they cannot be mixed up with real people.
-- HOW: deleting a row from auth.users removes the profile and, through ON DELETE CASCADE, the content that belongs to it (posts, comments, jobs they posted, messages ...).
-- Step 1 shows exactly who will be removed. Step 2 shows what content they own. Step 3 deletes. Anything still left afterwards is listed by step 4.
--
-- STEP 1 (read only): the accounts that will go.
--   select id, email, created_at from auth.users where email ilike 'cctest.%@example.com' order by created_at;
-- STEP 2 (read only): what they own (should all be test data).
--   select 'jobs' as what, count(*) from public.jobs where posted_by in (select id from auth.users where email ilike 'cctest.%@example.com')
--   union all select 'posts', count(*) from public.posts where author_id in (select id from auth.users where email ilike 'cctest.%@example.com')
--   union all select 'projects', count(*) from public.projects where owner_id in (select id from auth.users where email ilike 'cctest.%@example.com');
--   (if a table or column name differs in your project, skip that line: it is only a preview)

-- STEP 3: delete (only the exact test pattern; real addresses never end in @example.com).
DELETE FROM auth.users WHERE email ILIKE 'cctest.%@example.com';

-- STEP 4 (read only, after step 3): should return 0 rows.
--   select id, username from public.profiles where username ilike 'cct\_%' ;
-- If rows remain, the profile was not tied to auth.users by a cascade: tell me and I will extend this file.
