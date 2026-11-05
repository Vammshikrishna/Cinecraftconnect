-- PART EK - let signed-in people read the discussion room categories again. Safe to run more than once. Run any time.
--
-- WHAT WENT WRONG: public.room_categories has row level security switched on but NO policy at all (the Supabase linter reports it as
-- "RLS Enabled No Policy"). With RLS on and no policy, nobody except the server key can read the table. The website and the app both
-- read it directly: the category list when creating a room and in room settings, and the category name shown on every room card and
-- room page (the "room_categories(name)" part of the room queries). So the pickers were empty and rooms fell back to "General".
-- The earlier policy "Auth View Room Categories" (read for signed-in people) is in the old migrations in supabase/archive but is missing
-- from the live database.
-- THE FIX: one read-only policy for signed-in people. Nobody can add, change or delete categories from the app (there is still no
-- policy for that); they stay a server-side list.
--
-- The OTHER 27 tables in the same linter list need nothing: they are not read by the website or the app directly. They are used only
-- through SECURITY DEFINER functions (record_*_view, vote_in_poll, invite_post_collaborators, log_post_impressions, wishlist token functions...)
-- or by server functions with the service key (key_vault, ledger, payouts, billing). "RLS on, no policy" is the intended locked-down state there.
--
-- PREFLIGHT (read only):  select policyname from pg_policies where schemaname = 'public' and tablename = 'room_categories';   -- expect 0 rows
-- POST-CHECK (read only): select policyname, cmd, roles from pg_policies where schemaname = 'public' and tablename = 'room_categories';
--                         -- expect 1 row: Auth View Room Categories | SELECT | {authenticated}

ALTER TABLE public.room_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth View Room Categories" ON public.room_categories;
CREATE POLICY "Auth View Room Categories"
  ON public.room_categories
  FOR SELECT
  TO authenticated
  USING (true);
