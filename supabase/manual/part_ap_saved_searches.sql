-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Part AP – Saved searches
--   People can save a search (text + category + filters) and run it again from the Search screen on web and mobile.
--   Private to each person, at most 20 each. Until this is run the apps simply hide "Saved searches".
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE TABLE IF NOT EXISTS public.saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  query text NOT NULL DEFAULT '' CHECK (char_length(query) <= 120),
  category text NOT NULL DEFAULT 'all' CHECK (char_length(category) <= 20),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(filters) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON public.saved_searches (user_id, created_at DESC);

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS saved_searches_select ON public.saved_searches;
DROP POLICY IF EXISTS saved_searches_insert ON public.saved_searches;
DROP POLICY IF EXISTS saved_searches_delete ON public.saved_searches;
CREATE POLICY saved_searches_select ON public.saved_searches FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY saved_searches_insert ON public.saved_searches FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY saved_searches_delete ON public.saved_searches FOR DELETE TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.saved_searches FROM anon, PUBLIC;
GRANT SELECT, INSERT, DELETE ON public.saved_searches TO authenticated;

-- at most 20 per person
CREATE OR REPLACE FUNCTION public.guard_saved_searches()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  NEW.name := btrim(NEW.name);
  IF (SELECT count(*) FROM public.saved_searches WHERE user_id = NEW.user_id) >= 20 THEN
    RAISE EXCEPTION 'You can save up to 20 searches. Remove one first.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_saved_searches ON public.saved_searches;
CREATE TRIGGER trg_guard_saved_searches BEFORE INSERT ON public.saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.guard_saved_searches();

COMMIT;
