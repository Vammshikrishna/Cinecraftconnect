-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Part AC – Ratings: new features
--   * weighted score (a title with 2 votes no longer outranks one with 500)
--   * creator replies to reviews (one reply per review, the reviewer is notified)
--   * trending on CineCraft (rating activity of the last days)
--   * lists ("My Top 10"): private or public, with a share link
-- Run after part AB, then deploy the new web + mobile builds.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1. weighted score: (v / (v + m)) * R + (m / (v + m)) * C   (m = 5 votes, C = 3.5 stars prior) ────────────────
CREATE OR REPLACE FUNCTION public.film_weighted_score(p_avg numeric, p_count bigint)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN COALESCE(p_count, 0) = 0 THEN NULL
              ELSE ROUND(((p_count::numeric / (p_count + 5)) * p_avg + (5::numeric / (p_count + 5)) * 3.5), 2) END;
$$;

CREATE OR REPLACE FUNCTION public.get_film_rating_detail(p_tmdb_id integer DEFAULT NULL, p_cinema_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH x AS (
    SELECT ufr.rating, (COALESCE(p.account_type, 'fan') <> 'fan') AS is_pro
      FROM public.user_film_ratings ufr
      LEFT JOIN public.profiles p ON p.id = ufr.user_id
     WHERE (p_tmdb_id IS NOT NULL AND ufr.tmdb_id = p_tmdb_id)
        OR (p_cinema_id IS NOT NULL AND ufr.platform_cinema_id = p_cinema_id)
  )
  SELECT jsonb_build_object(
    'overall_average', ROUND(AVG(rating)::numeric, 1), 'overall_count', COUNT(*),
    'weighted_average', public.film_weighted_score(AVG(rating)::numeric, COUNT(*)),
    'pro_average', ROUND((AVG(rating) FILTER (WHERE is_pro))::numeric, 1), 'pro_count', COUNT(*) FILTER (WHERE is_pro),
    'fan_average', ROUND((AVG(rating) FILTER (WHERE NOT is_pro))::numeric, 1), 'fan_count', COUNT(*) FILTER (WHERE NOT is_pro),
    'histogram', jsonb_build_object(
      '1', COUNT(*) FILTER (WHERE rating <= 1), '2', COUNT(*) FILTER (WHERE rating > 1 AND rating <= 2),
      '3', COUNT(*) FILTER (WHERE rating > 2 AND rating <= 3), '4', COUNT(*) FILTER (WHERE rating > 3 AND rating <= 4),
      '5', COUNT(*) FILTER (WHERE rating > 4))
  ) FROM x;
$$;

-- ── 2. creator replies ───────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.film_review_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL UNIQUE REFERENCES public.film_reviews(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reply_text text NOT NULL CHECK (char_length(reply_text) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.film_review_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS film_review_replies_select ON public.film_review_replies;
DROP POLICY IF EXISTS film_review_replies_delete ON public.film_review_replies;
CREATE POLICY film_review_replies_select ON public.film_review_replies FOR SELECT USING (true);
CREATE POLICY film_review_replies_delete ON public.film_review_replies FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_market_admin());
-- no INSERT / UPDATE policy: replies are written through reply_to_review()

CREATE OR REPLACE FUNCTION public.reply_to_review(p_review_id uuid, p_text text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_text text := btrim(COALESCE(p_text, ''));
  v_review public.film_reviews%ROWTYPE;
  v_title text;
  v_creator uuid;
  v_existing uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  IF char_length(v_text) < 1 OR char_length(v_text) > 1000 THEN
    RAISE EXCEPTION 'A reply must be between 1 and 1000 characters' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_review FROM public.film_reviews WHERE id = p_review_id;
  IF NOT FOUND OR v_review.platform_cinema_id IS NULL THEN
    RAISE EXCEPTION 'Review not found' USING ERRCODE = 'P0001';
  END IF;
  SELECT creator_id, title INTO v_creator, v_title FROM public.platform_cinema WHERE id = v_review.platform_cinema_id;
  IF v_creator IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Only the creator of this title can reply' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_existing FROM public.film_review_replies WHERE review_id = p_review_id;
  IF v_existing IS NULL THEN
    INSERT INTO public.film_review_replies (review_id, author_id, reply_text) VALUES (p_review_id, v_uid, v_text);
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
    VALUES (v_review.user_id, v_uid, 'film_reply', 'The creator replied to your review', left(v_title, 120),
            '/content/movie/' || v_review.platform_cinema_id::text, v_review.platform_cinema_id, false);
  ELSE
    UPDATE public.film_review_replies SET reply_text = v_text, updated_at = now() WHERE id = v_existing;
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.reply_to_review(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reply_to_review(uuid, text) TO authenticated;

-- reviews now carry the creator's reply and whether I may reply
DROP FUNCTION IF EXISTS public.list_film_reviews(integer, uuid, text, integer, integer, text, boolean);
CREATE OR REPLACE FUNCTION public.list_film_reviews(
  p_tmdb_id integer DEFAULT NULL,
  p_cinema_id uuid DEFAULT NULL,
  p_sort text DEFAULT 'helpful',
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_segment text DEFAULT 'all',
  p_hide_spoilers boolean DEFAULT false
) RETURNS TABLE (
  id uuid, review_text text, is_spoiler boolean, is_anonymous boolean, helpful_count integer,
  created_at timestamptz, updated_at timestamptz,
  author_id uuid, author_name text, author_avatar text, author_craft text,
  rating numeric, is_mine boolean, marked_helpful boolean,
  reply_text text, reply_at timestamptz, reply_by_name text, can_reply boolean
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
         EXISTS (SELECT 1 FROM public.review_helpful_marks m WHERE m.review_id = r.id AND m.user_id = auth.uid()),
         rp.reply_text, rp.updated_at, rpp.full_name,
         (r.platform_cinema_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.platform_cinema c WHERE c.id = r.platform_cinema_id AND c.creator_id = auth.uid()))
    FROM public.film_reviews r
    LEFT JOIN public.profiles p ON p.id = r.user_id
    LEFT JOIN public.user_film_ratings ufr
           ON ufr.user_id = r.user_id
          AND ((r.tmdb_id IS NOT NULL AND ufr.tmdb_id = r.tmdb_id)
            OR (r.platform_cinema_id IS NOT NULL AND ufr.platform_cinema_id = r.platform_cinema_id))
    LEFT JOIN public.film_review_replies rp ON rp.review_id = r.id
    LEFT JOIN public.profiles rpp ON rpp.id = rp.author_id
   WHERE ((p_tmdb_id IS NOT NULL AND r.tmdb_id = p_tmdb_id)
       OR (p_cinema_id IS NOT NULL AND r.platform_cinema_id = p_cinema_id))
     AND (p_segment NOT IN ('pro', 'fan')
          OR (p_segment = 'pro' AND COALESCE(p.account_type, 'fan') <> 'fan')
          OR (p_segment = 'fan' AND COALESCE(p.account_type, 'fan') = 'fan'))
     AND (NOT COALESCE(p_hide_spoilers, false) OR NOT COALESCE(r.is_spoiler, false))
   ORDER BY CASE WHEN p_sort = 'newest' THEN r.created_at END DESC NULLS LAST,
            r.helpful_count DESC, r.created_at DESC
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;
REVOKE ALL ON FUNCTION public.list_film_reviews(integer, uuid, text, integer, integer, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_film_reviews(integer, uuid, text, integer, integer, text, boolean) TO anon, authenticated;

-- ── 3. trending on CineCraft ─────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trending_community_titles(p_days integer DEFAULT 7, p_limit integer DEFAULT 12)
RETURNS TABLE (
  tmdb_id integer, platform_cinema_id uuid, media_type text, title text, poster_path text,
  recent_count bigint, average_rating numeric, weighted_average numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH recent AS (
    SELECT ufr.tmdb_id, ufr.platform_cinema_id, COUNT(*) AS recent_count
      FROM public.user_film_ratings ufr
     WHERE ufr.updated_at > now() - make_interval(days => LEAST(GREATEST(COALESCE(p_days, 7), 1), 60))
     GROUP BY ufr.tmdb_id, ufr.platform_cinema_id
  ), allt AS (
    SELECT ufr.tmdb_id, ufr.platform_cinema_id, AVG(ufr.rating) AS avg_all, COUNT(*) AS cnt_all,
           (array_agg(ufr.title) FILTER (WHERE ufr.title IS NOT NULL))[1] AS title,
           (array_agg(ufr.poster_path) FILTER (WHERE ufr.poster_path IS NOT NULL))[1] AS poster_path,
           (array_agg(ufr.media_type) FILTER (WHERE ufr.media_type IS NOT NULL))[1] AS media_type
      FROM public.user_film_ratings ufr
      JOIN recent r ON r.tmdb_id IS NOT DISTINCT FROM ufr.tmdb_id AND r.platform_cinema_id IS NOT DISTINCT FROM ufr.platform_cinema_id
     GROUP BY ufr.tmdb_id, ufr.platform_cinema_id
  )
  SELECT a.tmdb_id, a.platform_cinema_id, a.media_type, a.title, a.poster_path, r.recent_count,
         ROUND(a.avg_all::numeric, 1), public.film_weighted_score(a.avg_all::numeric, a.cnt_all)
    FROM allt a
    JOIN recent r ON r.tmdb_id IS NOT DISTINCT FROM a.tmdb_id AND r.platform_cinema_id IS NOT DISTINCT FROM a.platform_cinema_id
   WHERE a.title IS NOT NULL
     AND (a.platform_cinema_id IS NULL OR EXISTS (SELECT 1 FROM public.platform_cinema c WHERE c.id = a.platform_cinema_id AND c.is_published))
   ORDER BY r.recent_count DESC, public.film_weighted_score(a.avg_all::numeric, a.cnt_all) DESC
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 12), 1), 30);
$$;
REVOKE ALL ON FUNCTION public.trending_community_titles(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trending_community_titles(integer, integer) TO anon, authenticated;

-- ── 4. lists ─────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.film_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  description text CHECK (description IS NULL OR char_length(description) <= 300),
  is_public boolean NOT NULL DEFAULT false,
  item_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS film_lists_user ON public.film_lists (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.film_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.film_lists(id) ON DELETE CASCADE,
  tmdb_id integer,
  platform_cinema_id uuid REFERENCES public.platform_cinema(id) ON DELETE CASCADE,
  media_type text,
  title text,
  poster_path text,
  added_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT film_list_items_one_target CHECK ((tmdb_id IS NOT NULL) <> (platform_cinema_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS film_list_items_tmdb ON public.film_list_items (list_id, tmdb_id) WHERE tmdb_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS film_list_items_cinema ON public.film_list_items (list_id, platform_cinema_id) WHERE platform_cinema_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS film_list_items_list ON public.film_list_items (list_id, added_at DESC);

ALTER TABLE public.film_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.film_list_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS film_lists_select ON public.film_lists;
DROP POLICY IF EXISTS film_lists_insert ON public.film_lists;
DROP POLICY IF EXISTS film_lists_update ON public.film_lists;
DROP POLICY IF EXISTS film_lists_delete ON public.film_lists;
DROP POLICY IF EXISTS film_list_items_select ON public.film_list_items;
DROP POLICY IF EXISTS film_list_items_insert ON public.film_list_items;
DROP POLICY IF EXISTS film_list_items_delete ON public.film_list_items;

CREATE POLICY film_lists_select ON public.film_lists FOR SELECT USING (is_public OR user_id = auth.uid());
CREATE POLICY film_lists_insert ON public.film_lists FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY film_lists_update ON public.film_lists FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY film_lists_delete ON public.film_lists FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY film_list_items_select ON public.film_list_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.film_lists l WHERE l.id = list_id AND (l.is_public OR l.user_id = auth.uid())));
CREATE POLICY film_list_items_insert ON public.film_list_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.film_lists l WHERE l.id = list_id AND l.user_id = auth.uid()));
CREATE POLICY film_list_items_delete ON public.film_list_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.film_lists l WHERE l.id = list_id AND l.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.guard_film_list()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.market_is_system() THEN
    RETURN NEW;
  END IF;
  NEW.name := btrim(NEW.name);
  IF TG_OP = 'INSERT' THEN
    NEW.item_count := 0;
    IF (SELECT count(*) FROM public.film_lists WHERE user_id = NEW.user_id) >= 50 THEN
      RAISE EXCEPTION 'You can have up to 50 lists' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    NEW.user_id := OLD.user_id;
    NEW.item_count := OLD.item_count;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_film_list ON public.film_lists;
CREATE TRIGGER trg_guard_film_list BEFORE INSERT OR UPDATE ON public.film_lists
  FOR EACH ROW EXECUTE FUNCTION public.guard_film_list();

CREATE OR REPLACE FUNCTION public.guard_film_list_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  NEW.title := left(NEW.title, 200);
  NEW.poster_path := left(NEW.poster_path, 500);
  IF NEW.media_type IS NOT NULL AND NEW.media_type NOT IN ('movie', 'tv', 'short', 'ad') THEN
    NEW.media_type := NULL;
  END IF;
  IF (SELECT count(*) FROM public.film_list_items WHERE list_id = NEW.list_id) >= 200 THEN
    RAISE EXCEPTION 'A list can hold up to 200 titles' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_film_list_item ON public.film_list_items;
CREATE TRIGGER trg_guard_film_list_item BEFORE INSERT ON public.film_list_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_film_list_item();

CREATE OR REPLACE FUNCTION public.film_list_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM set_config('app.market_system', '1', true);
  IF TG_OP = 'INSERT' THEN
    UPDATE public.film_lists SET item_count = item_count + 1, updated_at = now() WHERE id = NEW.list_id;
  ELSE
    UPDATE public.film_lists SET item_count = GREATEST(0, item_count - 1), updated_at = now() WHERE id = OLD.list_id;
  END IF;
  PERFORM set_config('app.market_system', '', true);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_film_list_count ON public.film_list_items;
CREATE TRIGGER trg_film_list_count AFTER INSERT OR DELETE ON public.film_list_items
  FOR EACH ROW EXECUTE FUNCTION public.film_list_count();

COMMIT;
