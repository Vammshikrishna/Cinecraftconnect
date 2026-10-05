-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Part AB – Ratings: missing features
--   * ratings remember the title / poster (My Ratings page, and fixes the mobile list rating that sent these columns)
--   * watchlist ("want to watch")
--   * review filters (all / pro / fan, hide spoilers) with paging
--   * creators are notified about new reviews and ratings on their platform titles
-- Run after part AA, then deploy the new web + mobile builds.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1. ratings keep the title + poster ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_film_ratings ADD COLUMN IF NOT EXISTS media_type text;
ALTER TABLE public.user_film_ratings ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.user_film_ratings ADD COLUMN IF NOT EXISTS poster_path text;

-- platform titles can be filled in right away
UPDATE public.user_film_ratings r
   SET title = COALESCE(r.title, c.title), poster_path = COALESCE(r.poster_path, c.poster_url), media_type = COALESCE(r.media_type, c.type)
  FROM public.platform_cinema c
 WHERE r.platform_cinema_id = c.id AND (r.title IS NULL OR r.poster_path IS NULL);

CREATE INDEX IF NOT EXISTS idx_user_film_ratings_user ON public.user_film_ratings (user_id, updated_at DESC);

-- ── 2. save function: now also takes the title details (old 6-argument callers keep working) ─────────────────────
DROP FUNCTION IF EXISTS public.submit_film_feedback(integer, uuid, numeric, text, boolean, boolean);
CREATE OR REPLACE FUNCTION public.submit_film_feedback(
  p_tmdb_id integer DEFAULT NULL,
  p_cinema_id uuid DEFAULT NULL,
  p_rating numeric DEFAULT NULL,
  p_review text DEFAULT NULL,
  p_spoiler boolean DEFAULT false,
  p_anonymous boolean DEFAULT false,
  p_media_type text DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_poster text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_text text := NULLIF(btrim(COALESCE(p_review, '')), '');
  v_type text := CASE WHEN p_media_type IN ('movie', 'tv', 'short', 'ad') THEN p_media_type ELSE NULL END;
  v_title text := left(NULLIF(btrim(COALESCE(p_title, '')), ''), 200);
  v_poster text := left(NULLIF(btrim(COALESCE(p_poster, '')), ''), 500);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  IF (p_tmdb_id IS NULL) = (p_cinema_id IS NULL) THEN
    RAISE EXCEPTION 'Choose exactly one title' USING ERRCODE = 'P0001';
  END IF;
  IF p_cinema_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.platform_cinema WHERE id = p_cinema_id AND is_published) THEN
    RAISE EXCEPTION 'This title is not available' USING ERRCODE = 'P0001';
  END IF;
  IF p_rating IS NULL AND v_text IS NULL THEN
    RAISE EXCEPTION 'Add a rating or a review' USING ERRCODE = 'P0001';
  END IF;
  IF p_rating IS NOT NULL AND (p_rating < 0 OR p_rating > 5) THEN
    RAISE EXCEPTION 'A rating is between 0 and 5' USING ERRCODE = 'P0001';
  END IF;

  IF p_rating IS NOT NULL THEN
    IF p_tmdb_id IS NOT NULL THEN
      INSERT INTO public.user_film_ratings (user_id, tmdb_id, rating, media_type, title, poster_path)
      VALUES (v_uid, p_tmdb_id, p_rating, v_type, v_title, v_poster)
      ON CONFLICT (user_id, tmdb_id) DO UPDATE
        SET rating = EXCLUDED.rating, updated_at = now(),
            media_type = COALESCE(EXCLUDED.media_type, public.user_film_ratings.media_type),
            title = COALESCE(EXCLUDED.title, public.user_film_ratings.title),
            poster_path = COALESCE(EXCLUDED.poster_path, public.user_film_ratings.poster_path);
    ELSE
      INSERT INTO public.user_film_ratings (user_id, platform_cinema_id, rating, media_type, title, poster_path)
      SELECT v_uid, p_cinema_id, p_rating, c.type, c.title, c.poster_url FROM public.platform_cinema c WHERE c.id = p_cinema_id
      ON CONFLICT (user_id, platform_cinema_id) DO UPDATE
        SET rating = EXCLUDED.rating, updated_at = now();
    END IF;
  END IF;

  IF v_text IS NOT NULL THEN
    IF p_tmdb_id IS NOT NULL THEN
      INSERT INTO public.film_reviews (user_id, tmdb_id, review_text, is_spoiler, is_anonymous)
      VALUES (v_uid, p_tmdb_id, v_text, COALESCE(p_spoiler, false), COALESCE(p_anonymous, false))
      ON CONFLICT (user_id, tmdb_id) DO UPDATE
        SET review_text = EXCLUDED.review_text, is_spoiler = EXCLUDED.is_spoiler, is_anonymous = EXCLUDED.is_anonymous;
    ELSE
      INSERT INTO public.film_reviews (user_id, platform_cinema_id, review_text, is_spoiler, is_anonymous)
      VALUES (v_uid, p_cinema_id, v_text, COALESCE(p_spoiler, false), COALESCE(p_anonymous, false))
      ON CONFLICT (user_id, platform_cinema_id) DO UPDATE
        SET review_text = EXCLUDED.review_text, is_spoiler = EXCLUDED.is_spoiler, is_anonymous = EXCLUDED.is_anonymous;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_film_feedback(integer, uuid, numeric, text, boolean, boolean, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_film_feedback(integer, uuid, numeric, text, boolean, boolean, text, text, text) TO authenticated;

-- ── 3. watchlist ─────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.film_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tmdb_id integer,
  platform_cinema_id uuid REFERENCES public.platform_cinema(id) ON DELETE CASCADE,
  media_type text,
  title text,
  poster_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT film_watchlist_one_target CHECK ((tmdb_id IS NOT NULL) <> (platform_cinema_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS film_watchlist_user_tmdb ON public.film_watchlist (user_id, tmdb_id) WHERE tmdb_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS film_watchlist_user_cinema ON public.film_watchlist (user_id, platform_cinema_id) WHERE platform_cinema_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS film_watchlist_user_created ON public.film_watchlist (user_id, created_at DESC);

ALTER TABLE public.film_watchlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS film_watchlist_select ON public.film_watchlist;
DROP POLICY IF EXISTS film_watchlist_insert ON public.film_watchlist;
DROP POLICY IF EXISTS film_watchlist_delete ON public.film_watchlist;
CREATE POLICY film_watchlist_select ON public.film_watchlist FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY film_watchlist_insert ON public.film_watchlist FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY film_watchlist_delete ON public.film_watchlist FOR DELETE TO authenticated USING (user_id = auth.uid());
-- no UPDATE policy: an entry is added or removed

CREATE OR REPLACE FUNCTION public.guard_film_watchlist()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  NEW.title := left(NEW.title, 200);
  NEW.poster_path := left(NEW.poster_path, 500);
  IF NEW.media_type IS NOT NULL AND NEW.media_type NOT IN ('movie', 'tv', 'short', 'ad') THEN
    NEW.media_type := NULL;
  END IF;
  IF (SELECT count(*) FROM public.film_watchlist WHERE user_id = NEW.user_id) >= 500 THEN
    RAISE EXCEPTION 'Your watchlist is full (500 titles)' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_film_watchlist ON public.film_watchlist;
CREATE TRIGGER trg_guard_film_watchlist BEFORE INSERT ON public.film_watchlist
  FOR EACH ROW EXECUTE FUNCTION public.guard_film_watchlist();

-- ── 4. reviews: filter by who wrote it, hide spoilers ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.list_film_reviews(integer, uuid, text, integer, integer);
CREATE OR REPLACE FUNCTION public.list_film_reviews(
  p_tmdb_id integer DEFAULT NULL,
  p_cinema_id uuid DEFAULT NULL,
  p_sort text DEFAULT 'helpful',
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_segment text DEFAULT 'all',           -- all | pro | fan
  p_hide_spoilers boolean DEFAULT false
) RETURNS TABLE (
  id uuid, review_text text, is_spoiler boolean, is_anonymous boolean, helpful_count integer,
  created_at timestamptz, updated_at timestamptz,
  author_id uuid, author_name text, author_avatar text, author_craft text,
  rating numeric, is_mine boolean, marked_helpful boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT r.id, r.review_text, COALESCE(r.is_spoiler, false), COALESCE(r.is_anonymous, false), COALESCE(r.helpful_count, 0),
         r.created_at, r.updated_at,
         CASE WHEN COALESCE(r.is_anonymous, false) AND r.user_id IS DISTINCT FROM auth.uid() THEN NULL ELSE r.user_id END,
         CASE WHEN COALESCE(r.is_anonymous, false) AND r.user_id IS DISTINCT FROM auth.uid() THEN NULL ELSE p.full_name END,
         CASE WHEN COALESCE(r.is_anonymous, false) AND r.user_id IS DISTINCT FROM auth.uid() THEN NULL ELSE p.avatar_url END,
         CASE WHEN COALESCE(r.is_anonymous, false) AND r.user_id IS DISTINCT FROM auth.uid() THEN NULL ELSE p.craft END,
         ufr.rating,
         (r.user_id = auth.uid()),
         EXISTS (SELECT 1 FROM public.review_helpful_marks m WHERE m.review_id = r.id AND m.user_id = auth.uid())
    FROM public.film_reviews r
    LEFT JOIN public.profiles p ON p.id = r.user_id
    LEFT JOIN public.user_film_ratings ufr
           ON ufr.user_id = r.user_id
          AND ((r.tmdb_id IS NOT NULL AND ufr.tmdb_id = r.tmdb_id)
            OR (r.platform_cinema_id IS NOT NULL AND ufr.platform_cinema_id = r.platform_cinema_id))
   WHERE ((p_tmdb_id IS NOT NULL AND r.tmdb_id = p_tmdb_id)
       OR (p_cinema_id IS NOT NULL AND r.platform_cinema_id = p_cinema_id))
     AND (p_segment NOT IN ('pro', 'fan')
          OR (p_segment = 'pro' AND COALESCE(p.account_type, 'fan') <> 'fan')
          OR (p_segment = 'fan' AND COALESCE(p.account_type, 'fan') = 'fan'))
     AND (NOT COALESCE(p_hide_spoilers, false) OR NOT COALESCE(r.is_spoiler, false))
   ORDER BY CASE WHEN p_sort = 'newest' THEN r.created_at END DESC NULLS LAST,
            CASE WHEN p_sort = 'mine_first' THEN (r.user_id = auth.uid()) END DESC NULLS LAST,
            r.helpful_count DESC, r.created_at DESC
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;
REVOKE ALL ON FUNCTION public.list_film_reviews(integer, uuid, text, integer, integer, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_film_reviews(integer, uuid, text, integer, integer, text, boolean) TO anon, authenticated;

-- ── 5. creators hear about reviews and ratings on their platform titles ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_cinema_creator_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_creator uuid;
  v_title text;
  v_name text;
BEGIN
  IF NEW.platform_cinema_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT creator_id, title INTO v_creator, v_title FROM public.platform_cinema WHERE id = NEW.platform_cinema_id;
  IF v_creator IS NULL OR v_creator = NEW.user_id THEN
    RETURN NULL;
  END IF;
  -- one notification per person per title (editing a review does not notify again)
  IF EXISTS (SELECT 1 FROM public.notifications
              WHERE user_id = v_creator AND type = 'film_review' AND related_id = NEW.platform_cinema_id AND trigger_user_id = NEW.user_id) THEN
    RETURN NULL;
  END IF;
  IF COALESCE(NEW.is_anonymous, false) THEN
    v_name := 'Someone';
  ELSE
    SELECT COALESCE(full_name, 'Someone') INTO v_name FROM public.profiles WHERE id = NEW.user_id;
  END IF;
  INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
  VALUES (v_creator,
          CASE WHEN COALESCE(NEW.is_anonymous, false) THEN NULL ELSE NEW.user_id END,
          'film_review', v_name || ' reviewed your work', left(v_title, 120),
          '/content/movie/' || NEW.platform_cinema_id::text, NEW.platform_cinema_id, false);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_cinema_review ON public.film_reviews;
CREATE TRIGGER trg_notify_cinema_review AFTER INSERT ON public.film_reviews
  FOR EACH ROW EXECUTE FUNCTION public.notify_cinema_creator_review();

COMMIT;
