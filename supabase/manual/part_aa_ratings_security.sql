-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Part AA – Ratings & reviews: security and bug fixes
--   * "Helpful" counts really count now (the trigger could not update other people's reviews) and cannot be edited
--   * no helpful on your own review, no rating / reviewing your own work
--   * anonymous reviews no longer leak the author; other people's ratings are private (only totals are public)
--   * one atomic save for rating + review, review/title limits, abuse limits
--   * platform cinema entries: protected columns, no fans, limits, takedown through the report flow
--   * pro / fan segments fixed (everyone who is not a fan is "pro"), segments work for platform titles too
-- Run after part Z. Then deploy the new web + mobile builds (they read reviews through list_film_reviews and save
-- through submit_film_feedback).
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1. constraints: duplicates out, sanity checks in (NOT VALID so old rows never block the migration) ─────────
ALTER TABLE public.film_reviews DROP CONSTRAINT IF EXISTS film_reviews_user_id_tmdb_id_key;   -- duplicate of film_reviews_user_tmdb_unique

ALTER TABLE public.film_reviews DROP CONSTRAINT IF EXISTS film_reviews_one_target;
ALTER TABLE public.film_reviews ADD CONSTRAINT film_reviews_one_target
  CHECK ((tmdb_id IS NOT NULL) <> (platform_cinema_id IS NOT NULL)) NOT VALID;
ALTER TABLE public.film_reviews DROP CONSTRAINT IF EXISTS film_reviews_text_len;
ALTER TABLE public.film_reviews ADD CONSTRAINT film_reviews_text_len
  CHECK (char_length(review_text) BETWEEN 1 AND 3000) NOT VALID;
ALTER TABLE public.film_reviews DROP CONSTRAINT IF EXISTS film_reviews_helpful_nonneg;
ALTER TABLE public.film_reviews ADD CONSTRAINT film_reviews_helpful_nonneg CHECK (helpful_count >= 0) NOT VALID;

ALTER TABLE public.user_film_ratings DROP CONSTRAINT IF EXISTS user_film_ratings_one_target;
ALTER TABLE public.user_film_ratings ADD CONSTRAINT user_film_ratings_one_target
  CHECK ((tmdb_id IS NOT NULL) <> (platform_cinema_id IS NOT NULL)) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_film_reviews_cinema ON public.film_reviews (platform_cinema_id) WHERE platform_cinema_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_film_ratings_tmdb ON public.user_film_ratings (tmdb_id) WHERE tmdb_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_film_ratings_cinema ON public.user_film_ratings (platform_cinema_id) WHERE platform_cinema_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_review_helpful_marks_user ON public.review_helpful_marks (user_id, created_at DESC);

-- ── 2. policies: drop every old (duplicated, over-open) policy and recreate a clean set ──────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
           WHERE schemaname = 'public'
             AND tablename IN ('film_reviews', 'user_film_ratings', 'review_helpful_marks', 'platform_cinema')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

ALTER TABLE public.film_reviews        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_film_ratings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_helpful_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_cinema     ENABLE ROW LEVEL SECURITY;

-- reviews: other people's reviews are read through list_film_reviews (hides anonymous authors)
CREATE POLICY film_reviews_select ON public.film_reviews FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_market_admin());
CREATE POLICY film_reviews_insert ON public.film_reviews FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY film_reviews_update ON public.film_reviews FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY film_reviews_delete ON public.film_reviews FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_market_admin());

-- ratings: private to the person; the public only ever sees totals (RPCs below)
CREATE POLICY user_film_ratings_select ON public.user_film_ratings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_market_admin());
CREATE POLICY user_film_ratings_insert ON public.user_film_ratings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY user_film_ratings_update ON public.user_film_ratings FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY user_film_ratings_delete ON public.user_film_ratings FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY review_helpful_select ON public.review_helpful_marks FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY review_helpful_insert ON public.review_helpful_marks FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY review_helpful_delete ON public.review_helpful_marks FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- platform cinema: public sees published titles; only the creator (never a fan) writes
CREATE POLICY platform_cinema_select ON public.platform_cinema FOR SELECT
  USING (is_published = true OR creator_id = auth.uid() OR public.is_market_admin());
CREATE POLICY platform_cinema_insert ON public.platform_cinema FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());
CREATE POLICY platform_cinema_update ON public.platform_cinema FOR UPDATE TO authenticated
  USING (creator_id = auth.uid()) WITH CHECK (creator_id = auth.uid());
CREATE POLICY platform_cinema_delete ON public.platform_cinema FOR DELETE TO authenticated
  USING (creator_id = auth.uid() OR public.is_market_admin());

-- ── 3. guards ────────────────────────────────────────────────────────────────────────────────────────────────────
-- reviews
CREATE OR REPLACE FUNCTION public.guard_film_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.market_is_system() OR public.is_market_admin() THEN
    RETURN NEW;
  END IF;

  NEW.review_text := btrim(COALESCE(NEW.review_text, ''));
  IF char_length(NEW.review_text) < 1 OR char_length(NEW.review_text) > 3000 THEN
    RAISE EXCEPTION 'A review must be between 1 and 3000 characters' USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.helpful_count := 0;
    NEW.created_at := now();
    IF (NEW.tmdb_id IS NULL) = (NEW.platform_cinema_id IS NULL) THEN
      RAISE EXCEPTION 'A review needs exactly one title' USING ERRCODE = 'P0001';
    END IF;
    IF (SELECT count(*) FROM public.film_reviews WHERE user_id = NEW.user_id AND created_at > now() - interval '1 hour') >= 20 THEN
      RAISE EXCEPTION 'You are posting reviews too quickly. Please try again later.' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    NEW.user_id := OLD.user_id;
    NEW.tmdb_id := OLD.tmdb_id;
    NEW.platform_cinema_id := OLD.platform_cinema_id;
    NEW.helpful_count := OLD.helpful_count;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := now();
  END IF;

  IF NEW.platform_cinema_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.platform_cinema WHERE id = NEW.platform_cinema_id AND creator_id = NEW.user_id) THEN
    RAISE EXCEPTION 'You cannot review your own work' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_film_review ON public.film_reviews;
CREATE TRIGGER trg_guard_film_review BEFORE INSERT OR UPDATE ON public.film_reviews
  FOR EACH ROW EXECUTE FUNCTION public.guard_film_review();

-- ratings
CREATE OR REPLACE FUNCTION public.guard_film_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.market_is_system() OR public.is_market_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF (NEW.tmdb_id IS NULL) = (NEW.platform_cinema_id IS NULL) THEN
      RAISE EXCEPTION 'A rating needs exactly one title' USING ERRCODE = 'P0001';
    END IF;
    IF (SELECT count(*) FROM public.user_film_ratings WHERE user_id = NEW.user_id AND created_at > now() - interval '1 hour') >= 200 THEN
      RAISE EXCEPTION 'You are rating too quickly. Please try again later.' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    NEW.user_id := OLD.user_id;
    NEW.tmdb_id := OLD.tmdb_id;
    NEW.platform_cinema_id := OLD.platform_cinema_id;
    NEW.created_at := OLD.created_at;
  END IF;

  IF NEW.platform_cinema_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.platform_cinema WHERE id = NEW.platform_cinema_id AND creator_id = NEW.user_id) THEN
    RAISE EXCEPTION 'You cannot rate your own work' USING ERRCODE = 'P0001';
  END IF;
  NEW.review := NULL;   -- legacy column; reviews live in film_reviews
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_film_rating ON public.user_film_ratings;
CREATE TRIGGER trg_guard_film_rating BEFORE INSERT OR UPDATE ON public.user_film_ratings
  FOR EACH ROW EXECUTE FUNCTION public.guard_film_rating();

-- helpful marks: not on your own review, with a rate limit
CREATE OR REPLACE FUNCTION public.guard_review_helpful()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.market_is_system() THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.film_reviews WHERE id = NEW.review_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'You cannot mark your own review as helpful' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.review_helpful_marks WHERE user_id = NEW.user_id AND created_at > now() - interval '1 hour') >= 100 THEN
    RAISE EXCEPTION 'Too many helpful marks. Please try again later.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_review_helpful ON public.review_helpful_marks;
CREATE TRIGGER trg_guard_review_helpful BEFORE INSERT ON public.review_helpful_marks
  FOR EACH ROW EXECUTE FUNCTION public.guard_review_helpful();

-- helpful counter: now runs as the system (the old one was blocked by RLS for everyone but the review's author)
CREATE OR REPLACE FUNCTION public.update_review_helpful_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM set_config('app.market_system', '1', true);
  IF TG_OP = 'INSERT' THEN
    UPDATE public.film_reviews SET helpful_count = helpful_count + 1 WHERE id = NEW.review_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.film_reviews SET helpful_count = GREATEST(0, helpful_count - 1) WHERE id = OLD.review_id;
  END IF;
  PERFORM set_config('app.market_system', '', true);
  RETURN NULL;
END;
$$;

-- one-time recount (the old counter never worked for other people's marks)
DO $$
BEGIN
  PERFORM set_config('app.market_system', '1', true);
  UPDATE public.film_reviews r
     SET helpful_count = COALESCE((SELECT count(*) FROM public.review_helpful_marks m WHERE m.review_id = r.id), 0);
  PERFORM set_config('app.market_system', '', true);
END $$;

-- platform cinema
CREATE OR REPLACE FUNCTION public.guard_platform_cinema()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.market_is_system() OR public.is_market_admin() THEN
    RETURN NEW;
  END IF;

  IF char_length(btrim(COALESCE(NEW.title, ''))) < 1 OR char_length(NEW.title) > 200 THEN
    RAISE EXCEPTION 'The title must be between 1 and 200 characters' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.overview IS NOT NULL AND char_length(NEW.overview) > 5000 THEN
    RAISE EXCEPTION 'The overview is too long (max 5000 characters)' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.runtime IS NOT NULL AND (NEW.runtime < 0 OR NEW.runtime > 1500) THEN
    RAISE EXCEPTION 'Please enter a valid runtime' USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.creator_id := auth.uid();
    NEW.view_count := 0;
    NEW.created_at := now();
    IF COALESCE((SELECT account_type FROM public.profiles WHERE id = auth.uid()), 'fan') = 'fan' THEN
      RAISE EXCEPTION 'Only creators and studios can submit work' USING ERRCODE = 'P0001';
    END IF;
    IF (SELECT count(*) FROM public.platform_cinema WHERE creator_id = auth.uid() AND created_at > now() - interval '1 day') >= 10 THEN
      RAISE EXCEPTION 'You can submit up to 10 titles a day' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    NEW.creator_id := OLD.creator_id;
    NEW.view_count := OLD.view_count;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_platform_cinema ON public.platform_cinema;
CREATE TRIGGER trg_guard_platform_cinema BEFORE INSERT OR UPDATE ON public.platform_cinema
  FOR EACH ROW EXECUTE FUNCTION public.guard_platform_cinema();

-- ── 4. public read functions (the only way to see other people's reviews / totals) ───────────────────────────────
-- Reviews of one title. Anonymous authors are hidden from everyone except themselves.
CREATE OR REPLACE FUNCTION public.list_film_reviews(
  p_tmdb_id integer DEFAULT NULL,
  p_cinema_id uuid DEFAULT NULL,
  p_sort text DEFAULT 'helpful',
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
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
   ORDER BY CASE WHEN p_sort = 'newest' THEN r.created_at END DESC NULLS LAST,
            r.helpful_count DESC, r.created_at DESC
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;
REVOKE ALL ON FUNCTION public.list_film_reviews(integer, uuid, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_film_reviews(integer, uuid, text, integer, integer) TO anon, authenticated;

-- Totals for one title: overall / pro / fan averages and a 1-5 star histogram. Works for TMDB and platform titles.
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
    'pro_average', ROUND((AVG(rating) FILTER (WHERE is_pro))::numeric, 1), 'pro_count', COUNT(*) FILTER (WHERE is_pro),
    'fan_average', ROUND((AVG(rating) FILTER (WHERE NOT is_pro))::numeric, 1), 'fan_count', COUNT(*) FILTER (WHERE NOT is_pro),
    'histogram', jsonb_build_object(
      '1', COUNT(*) FILTER (WHERE rating <= 1), '2', COUNT(*) FILTER (WHERE rating > 1 AND rating <= 2),
      '3', COUNT(*) FILTER (WHERE rating > 2 AND rating <= 3), '4', COUNT(*) FILTER (WHERE rating > 3 AND rating <= 4),
      '5', COUNT(*) FILTER (WHERE rating > 4))
  ) FROM x;
$$;
REVOKE ALL ON FUNCTION public.get_film_rating_detail(integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_film_rating_detail(integer, uuid) TO anon, authenticated;

-- List rows (same names as before so older builds keep working); capped input, fixed pro/fan buckets
CREATE OR REPLACE FUNCTION public.get_aggregated_film_ratings(tmdb_ids integer[])
RETURNS TABLE (tmdb_id integer, average_rating numeric, review_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT ufr.tmdb_id, ROUND(AVG(ufr.rating)::numeric, 1), COUNT(ufr.id)
    FROM public.user_film_ratings ufr
   WHERE ufr.tmdb_id = ANY (tmdb_ids[1:100])
   GROUP BY ufr.tmdb_id;
$$;

CREATE OR REPLACE FUNCTION public.get_segmented_film_ratings(tmdb_ids integer[])
RETURNS TABLE (tmdb_id integer, overall_average numeric, overall_count bigint, pro_average numeric, pro_count bigint, fan_average numeric, fan_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT ufr.tmdb_id,
         ROUND(AVG(ufr.rating)::numeric, 1), COUNT(*),
         ROUND((AVG(ufr.rating) FILTER (WHERE COALESCE(p.account_type, 'fan') <> 'fan'))::numeric, 1),
         COUNT(*) FILTER (WHERE COALESCE(p.account_type, 'fan') <> 'fan'),
         ROUND((AVG(ufr.rating) FILTER (WHERE COALESCE(p.account_type, 'fan') = 'fan'))::numeric, 1),
         COUNT(*) FILTER (WHERE COALESCE(p.account_type, 'fan') = 'fan')
    FROM public.user_film_ratings ufr
    LEFT JOIN public.profiles p ON p.id = ufr.user_id
   WHERE ufr.tmdb_id = ANY (tmdb_ids[1:100])
   GROUP BY ufr.tmdb_id;
$$;

-- platform titles in a list
CREATE OR REPLACE FUNCTION public.get_aggregated_cinema_ratings(cinema_ids uuid[])
RETURNS TABLE (platform_cinema_id uuid, average_rating numeric, review_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT ufr.platform_cinema_id, ROUND(AVG(ufr.rating)::numeric, 1), COUNT(ufr.id)
    FROM public.user_film_ratings ufr
   WHERE ufr.platform_cinema_id = ANY (cinema_ids[1:100])
   GROUP BY ufr.platform_cinema_id;
$$;

REVOKE ALL ON FUNCTION public.get_aggregated_film_ratings(integer[]), public.get_segmented_film_ratings(integer[]),
                       public.get_aggregated_cinema_ratings(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_aggregated_film_ratings(integer[]), public.get_segmented_film_ratings(integer[]),
                          public.get_aggregated_cinema_ratings(uuid[]) TO anon, authenticated;

-- ── 5. one atomic save: rating and/or review together (all or nothing) ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_film_feedback(
  p_tmdb_id integer DEFAULT NULL,
  p_cinema_id uuid DEFAULT NULL,
  p_rating numeric DEFAULT NULL,
  p_review text DEFAULT NULL,
  p_spoiler boolean DEFAULT false,
  p_anonymous boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_text text := NULLIF(btrim(COALESCE(p_review, '')), '');
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
      INSERT INTO public.user_film_ratings (user_id, tmdb_id, rating) VALUES (v_uid, p_tmdb_id, p_rating)
      ON CONFLICT (user_id, tmdb_id) DO UPDATE SET rating = EXCLUDED.rating, updated_at = now();
    ELSE
      INSERT INTO public.user_film_ratings (user_id, platform_cinema_id, rating) VALUES (v_uid, p_cinema_id, p_rating)
      ON CONFLICT (user_id, platform_cinema_id) DO UPDATE SET rating = EXCLUDED.rating, updated_at = now();
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
REVOKE ALL ON FUNCTION public.submit_film_feedback(integer, uuid, numeric, text, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_film_feedback(integer, uuid, numeric, text, boolean, boolean) TO authenticated;

-- ── 6. reports: reviews and platform titles can be reported and taken down (two-person flow) ─────────────────────
ALTER TABLE public.content_reports DROP CONSTRAINT IF EXISTS content_reports_target_type_check;
ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_target_type_check
  CHECK (target_type = ANY (ARRAY['post','comment','user','job','listing','room','message','announcement','review','cinema']));

CREATE OR REPLACE FUNCTION public._apply_report_action(
  p_report_id uuid, p_action text, p_note text, p_maker uuid, p_checker uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report public.content_reports%ROWTYPE;
  v_author uuid;
  v_tid uuid;
  v_deleted integer := 0;
BEGIN
  SELECT * INTO v_report FROM public.content_reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  BEGIN
    v_tid := v_report.target_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_tid := NULL;
  END;

  IF v_tid IS NOT NULL THEN
    v_author := CASE v_report.target_type
      WHEN 'user'    THEN v_tid
      WHEN 'post'    THEN (SELECT author_id FROM public.posts WHERE id = v_tid)
      WHEN 'comment' THEN (SELECT user_id FROM public.post_comments WHERE id = v_tid)
      WHEN 'job'     THEN (SELECT posted_by FROM public.jobs WHERE id = v_tid)
      WHEN 'listing' THEN (SELECT user_id FROM public.marketplace_listings WHERE id = v_tid)
      WHEN 'announcement' THEN (SELECT author_id FROM public.announcements WHERE id = v_tid)
      WHEN 'room'    THEN (SELECT creator_id FROM public.discussion_rooms WHERE id = v_tid)
      WHEN 'review'  THEN (SELECT user_id FROM public.film_reviews WHERE id = v_tid)
      WHEN 'cinema'  THEN (SELECT creator_id FROM public.platform_cinema WHERE id = v_tid)
      ELSE NULL
    END;
  END IF;

  IF p_action = 'takedown' THEN
    IF v_tid IS NULL OR v_report.target_type NOT IN ('post', 'comment', 'job', 'listing', 'room', 'announcement', 'review', 'cinema') THEN
      RAISE EXCEPTION 'Cannot take down target type % (use user management for accounts; messages are encrypted)', v_report.target_type;
    END IF;
    IF v_report.target_type = 'post' THEN DELETE FROM public.posts WHERE id = v_tid;
    ELSIF v_report.target_type = 'comment' THEN DELETE FROM public.post_comments WHERE id = v_tid;
    ELSIF v_report.target_type = 'job' THEN DELETE FROM public.jobs WHERE id = v_tid;
    ELSIF v_report.target_type = 'listing' THEN DELETE FROM public.marketplace_listings WHERE id = v_tid;
    ELSIF v_report.target_type = 'announcement' THEN DELETE FROM public.announcements WHERE id = v_tid;
    ELSIF v_report.target_type = 'room' THEN DELETE FROM public.discussion_rooms WHERE id = v_tid;
    ELSIF v_report.target_type = 'review' THEN DELETE FROM public.film_reviews WHERE id = v_tid;
    ELSIF v_report.target_type = 'cinema' THEN DELETE FROM public.platform_cinema WHERE id = v_tid;
    END IF;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    IF v_deleted = 0 THEN
      RAISE EXCEPTION 'Content no longer exists';
    END IF;
  ELSIF p_action = 'shadowban' THEN
    IF v_author IS NULL THEN
      RAISE EXCEPTION 'Could not determine the author of this content';
    END IF;
    UPDATE public.profiles SET is_shadowbanned = true, shadow_banned_at = now() WHERE id = v_author;
  ELSIF p_action <> 'dismiss' THEN
    RAISE EXCEPTION 'Unknown action %', p_action;
  END IF;

  UPDATE public.content_reports
     SET status = CASE WHEN p_action = 'dismiss' THEN 'dismissed' ELSE 'resolved' END,
         reviewed_by = COALESCE(p_checker, p_maker),
         reviewed_at = now(),
         resolution_note = COALESCE(p_note, p_action)
   WHERE id = p_report_id;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (COALESCE(p_checker, p_maker), 'moderator', 'report_' || p_action, v_report.target_type, v_report.target_id,
          jsonb_build_object('report_id', p_report_id, 'author_id', v_author, 'note', p_note,
                             'maker_id', p_maker, 'checker_id', p_checker));

  RETURN jsonb_build_object('success', true, 'action', p_action, 'author_id', v_author);
END;
$$;
REVOKE ALL ON FUNCTION public._apply_report_action(uuid, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;

COMMIT;
