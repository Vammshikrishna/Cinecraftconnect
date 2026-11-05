-- PART GB (saved views): a staff member can save a filter on an admin table under a name and open it again later. Safe to run more than once.
--
-- WHAT IT ADDS
--   * public.staff_saved_views   one row per saved view: who, which table ("scope", for example admin.tickets or admin.users), a name and the filter.
--                                Each person sees and changes only their own views. Moderators, admins and super admins can have views.
-- Nothing else changes. The filter is plain text/numbers the app understands; it is never run as SQL.
-- The web app keeps working before this is applied: the "Saved views" bar shows a short note and the filters still work, they just cannot be saved.
--
-- PREFLIGHT (read only):  select to_regclass('public.staff_saved_views');   -- null before
-- POST-CHECK  (read only): select polname from pg_policy where polrelid = 'public.staff_saved_views'::regclass;   -- staff_saved_views_own
--   Then in Admin > Support & Appeals pick a status, press "Save view", name it, reload the page: the view is listed and opens the same filter.

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.staff_saved_views (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  scope      text NOT NULL CHECK (scope ~ '^[a-z]+\.[a-z_]+$' AND length(scope) <= 40),
  name       text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 60),
  filter     jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(filter) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_saved_views_user_scope_name ON public.staff_saved_views (user_id, scope, name);

ALTER TABLE public.staff_saved_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_saved_views_own ON public.staff_saved_views;
CREATE POLICY staff_saved_views_own ON public.staff_saved_views FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) AND public.staff_rank((SELECT auth.uid())) >= 1)
  WITH CHECK (user_id = (SELECT auth.uid()) AND public.staff_rank((SELECT auth.uid())) >= 1);

REVOKE ALL ON public.staff_saved_views FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_saved_views TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
