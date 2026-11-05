-- PART DM - Fan accounts cannot create posts (finding F-01). Run once in the Supabase SQL editor. Safe to run more than once.
--
-- Before this, only the web and mobile apps hid the create-post button for Fans. The entitlement posts.create = false
-- for the 'fan' plan (part BV) is not enforced by any table rule, and has_entitlement() answers "yes" to everything
-- while billing_mode is 'beta', so it cannot be used here. This adds a plain rule that does not depend on billing:
--   1. BEFORE INSERT trigger on public.posts: refuses the row when the author's profiles.account_type is 'fan'.
--      (Posts keep their media in posts.media_items / media_urls, so there is no separate post-media table to guard.)
--   2. BEFORE INSERT trigger on public.post_polls (only if the table exists): same rule, through the post's author.
--      Polls are only attached through attach_post_poll() to a post the caller authored, so this is a second lock.
-- Staff accounts are already refused on posts by part BT (refuse_staff_social_action); nothing changes for them,
-- Creators, Studios or company-page posts. Existing posts written by Fans are not touched.
--
-- ── Read-only preflight (run this first, nothing is changed). Both numbers are informational: ──────────────
--   SELECT count(*) AS fan_accounts FROM public.profiles WHERE account_type = 'fan';
--   SELECT count(*) AS existing_posts_by_fans
--     FROM public.posts p JOIN public.profiles pr ON pr.id = p.author_id WHERE pr.account_type = 'fan';
--   SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.posts'::regclass AND NOT tgisinternal;   -- existing triggers
-- If existing_posts_by_fans is above 0 those posts stay visible; decide separately whether to remove them.

CREATE OR REPLACE FUNCTION public.refuse_fan_post_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_author uuid;
BEGIN
  IF TG_TABLE_NAME = 'post_polls' THEN
    SELECT p.author_id INTO v_author FROM public.posts p WHERE p.id = NEW.post_id;
  ELSE
    v_author := NEW.author_id;
  END IF;

  IF v_author IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles pr WHERE pr.id = v_author AND pr.account_type = 'fan'
  ) THEN
    RAISE EXCEPTION 'Fan accounts cannot create posts.'
      USING ERRCODE = 'check_violation',
            HINT = 'Fans can follow, like, comment and save. Posting is for creator and studio accounts.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.refuse_fan_post_insert() FROM PUBLIC;

DROP TRIGGER IF EXISTS refuse_fan_post_insert ON public.posts;
CREATE TRIGGER refuse_fan_post_insert BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.refuse_fan_post_insert();

DO $$
BEGIN
  IF to_regclass('public.post_polls') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS refuse_fan_post_insert ON public.post_polls';
    EXECUTE 'CREATE TRIGGER refuse_fan_post_insert BEFORE INSERT ON public.post_polls
             FOR EACH ROW EXECUTE FUNCTION public.refuse_fan_post_insert()';
  END IF;
END $$;

-- ── Check afterwards (read-only) ────────────────────────────────────────────────────────────────────────────
--   SELECT tgrelid::regclass AS table_name, tgname FROM pg_trigger WHERE tgname = 'refuse_fan_post_insert';   -- expect 2 rows
