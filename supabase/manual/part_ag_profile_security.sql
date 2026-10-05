-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Part AG – Profile: security and bug fixes
--   * credits must be accepted by the person before they show on their profile
--   * profile views are recorded by a function (signed-in viewers only, sender forced, once per 6 hours)
--   * usernames: case-insensitive unique, lower-case, 3-20 letters/digits/underscore, reserved names blocked
--   * safe profile lookup (id or exact username; no more matching on display names)
--   * skills, experience, portfolio and credits follow the person's profile visibility setting
--   * own account state (restriction flags, forced password reset) through a function
-- Run after part AF, then deploy the new web + mobile builds. The moderation-column lock is a separate file
-- (part_ag_lock_moderation_columns.sql) that you run LAST, once the new builds are live.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1. credits need a yes ────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.project_credits ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'accepted';   -- existing credits stay accepted
ALTER TABLE public.project_credits ADD COLUMN IF NOT EXISTS responded_at timestamptz;
ALTER TABLE public.project_credits ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.project_credits DROP CONSTRAINT IF EXISTS project_credits_status_check;
ALTER TABLE public.project_credits ADD CONSTRAINT project_credits_status_check CHECK (status IN ('pending', 'accepted', 'declined'));
CREATE INDEX IF NOT EXISTS idx_project_credits_user_status ON public.project_credits (user_id, status);

DROP POLICY IF EXISTS "Anyone can view project credits" ON public.project_credits;
DROP POLICY IF EXISTS project_credits_select ON public.project_credits;
CREATE POLICY project_credits_select ON public.project_credits FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_market_admin()
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_credits.project_id AND p.creator_id = auth.uid())
    OR (status = 'accepted' AND public.can_view_profile_extras(user_id))
  );

CREATE OR REPLACE FUNCTION public.guard_project_credit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.market_is_system() OR public.is_market_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := CASE WHEN NEW.user_id = auth.uid() THEN 'accepted' ELSE 'pending' END;
    NEW.responded_at := CASE WHEN NEW.user_id = auth.uid() THEN now() ELSE NULL END;
    NEW.verifier_id := auth.uid();
    NEW.created_at := now();
    NEW.role := left(btrim(COALESCE(NEW.role, '')), 100);
    NEW.project_title := left(btrim(COALESCE(NEW.project_title, '')), 150);
    IF NEW.role = '' OR NEW.project_title = '' THEN
      RAISE EXCEPTION 'A credit needs a role and a project title' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.blocked_users b WHERE b.user_id = NEW.user_id AND b.blocked_user_id = auth.uid()) THEN
      RAISE EXCEPTION 'You cannot credit this person' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.user_id <> auth.uid()
       AND (SELECT count(*) FROM public.project_credits WHERE verifier_id = auth.uid() AND created_at > now() - interval '1 day') >= 60 THEN
      RAISE EXCEPTION 'You have added a lot of credits today. Please try again tomorrow.' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'A credit cannot be edited' USING ERRCODE = 'P0001';
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_project_credit ON public.project_credits;
CREATE TRIGGER trg_guard_project_credit BEFORE INSERT OR UPDATE ON public.project_credits
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_credit();

CREATE OR REPLACE FUNCTION public.notify_credit_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_name text;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT COALESCE(full_name, username, 'Someone') INTO v_name FROM public.profiles WHERE id = NEW.verifier_id;
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
    VALUES (NEW.user_id, NEW.verifier_id, 'credit_request', 'New credit to confirm',
            v_name || ' credited you as ' || NEW.role || ' on ' || NEW.project_title, '/profile?tab=credits', NEW.id, false);
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_credit_request ON public.project_credits;
CREATE TRIGGER trg_notify_credit_request AFTER INSERT ON public.project_credits
  FOR EACH ROW EXECUTE FUNCTION public.notify_credit_request();

CREATE OR REPLACE FUNCTION public.respond_credit(p_id uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_row public.project_credits%ROWTYPE;
  v_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO v_row FROM public.project_credits WHERE id = p_id AND user_id = auth.uid() AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit not found' USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('app.market_system', '1', true);
  UPDATE public.project_credits SET status = CASE WHEN COALESCE(p_accept, false) THEN 'accepted' ELSE 'declined' END, responded_at = now() WHERE id = p_id;
  PERFORM set_config('app.market_system', '', true);

  IF COALESCE(p_accept, false) AND v_row.verifier_id IS NOT NULL AND v_row.verifier_id <> auth.uid() THEN
    SELECT COALESCE(full_name, username, 'Someone') INTO v_name FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
    VALUES (v_row.verifier_id, auth.uid(), 'credit_confirmed', 'Credit confirmed',
            v_name || ' confirmed the credit "' || v_row.role || '" on ' || v_row.project_title, '/profile/' || auth.uid()::text, p_id, false);
  END IF;
  RETURN jsonb_build_object('success', true, 'status', CASE WHEN COALESCE(p_accept, false) THEN 'accepted' ELSE 'declined' END);
END;
$$;
REVOKE ALL ON FUNCTION public.respond_credit(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_credit(uuid, boolean) TO authenticated;

-- ── 2. profile views through a function ──────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can insert profile views" ON public.profile_views;
REVOKE INSERT ON public.profile_views FROM anon, authenticated, PUBLIC;
CREATE INDEX IF NOT EXISTS idx_profile_views_dedupe ON public.profile_views (profile_id, viewer_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.record_profile_view(p_profile uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL OR p_profile IS NULL OR v_me = p_profile THEN
    RETURN;   -- only signed-in views of other people's profiles count
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_profile) THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.blocked_users b
              WHERE (b.user_id = v_me AND b.blocked_user_id = p_profile) OR (b.user_id = p_profile AND b.blocked_user_id = v_me)) THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.profile_views WHERE profile_id = p_profile AND viewer_id = v_me AND created_at > now() - interval '6 hours') THEN
    RETURN;
  END IF;
  INSERT INTO public.profile_views (profile_id, viewer_id) VALUES (p_profile, v_me);
END;
$$;
REVOKE ALL ON FUNCTION public.record_profile_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_profile_view(uuid) TO authenticated;

-- ── 3. usernames ─────────────────────────────────────────────────────────────────────────────────────────────────
-- two usernames that differ only by case: the later one gets a short suffix so the unique index can be created
WITH d AS (
  SELECT id, row_number() OVER (PARTITION BY lower(username) ORDER BY updated_at NULLS FIRST, id) AS rn
    FROM public.profiles WHERE username IS NOT NULL
)
UPDATE public.profiles p SET username = left(p.username, 15) || '_' || substr(p.id::text, 1, 4)
  FROM d WHERE d.id = p.id AND d.rn > 1;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key ON public.profiles (lower(username));

CREATE OR REPLACE FUNCTION public.guard_username()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_reserved text[] := ARRAY['admin', 'administrator', 'support', 'help', 'cinecraft', 'cinecraftconnect', 'official', 'moderator', 'mod',
                             'staff', 'team', 'security', 'system', 'root', 'null', 'undefined', 'api', 'www', 'me', 'profile', 'settings'];
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.username IS NOT DISTINCT FROM OLD.username THEN
    RETURN NEW;
  END IF;
  IF NEW.username IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.market_is_system() OR public.is_current_user_internal() THEN
    RETURN NEW;
  END IF;
  NEW.username := lower(btrim(NEW.username));
  IF NEW.username !~ '^[a-z0-9_]{3,20}$' THEN
    RAISE EXCEPTION 'A username is 3 to 20 letters, numbers or underscores' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.username = ANY (v_reserved) THEN
    RAISE EXCEPTION 'That username is reserved' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_username ON public.profiles;
CREATE TRIGGER trg_guard_username BEFORE INSERT OR UPDATE OF username ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_username();

CREATE OR REPLACE FUNCTION public.username_available(p_username text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT lower(btrim(p_username)) ~ '^[a-z0-9_]{3,20}$'
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(btrim(p_username)) AND id IS DISTINCT FROM auth.uid());
$$;
REVOKE ALL ON FUNCTION public.username_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO anon, authenticated;

-- ── 4. safe profile lookup: an id or an exact username, nothing else ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_profile_id(p_identifier text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p.id FROM public.profiles p
   WHERE (CASE WHEN btrim(p_identifier) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
               THEN p.id = btrim(p_identifier)::uuid
               ELSE lower(p.username) = lower(btrim(p_identifier)) END)
     AND (COALESCE(p.is_internal, false) = false OR p.id = auth.uid() OR public.is_current_user_internal())
   LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.resolve_profile_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_profile_id(text) TO anon, authenticated;

-- ── 5. skills, experience and portfolio follow the profile visibility setting ────────────────────────────────────
DROP POLICY IF EXISTS "Anyone view skills" ON public.user_skills;
DROP POLICY IF EXISTS user_skills_select ON public.user_skills;
CREATE POLICY user_skills_select ON public.user_skills FOR SELECT USING (public.can_view_profile_extras(user_id));

DROP POLICY IF EXISTS "Anyone view experience" ON public.user_experience;
DROP POLICY IF EXISTS user_experience_select ON public.user_experience;
CREATE POLICY user_experience_select ON public.user_experience FOR SELECT USING (public.can_view_profile_extras(user_id));

DROP POLICY IF EXISTS "Anyone can view portfolio items" ON public.portfolio_items;
DROP POLICY IF EXISTS portfolio_items_select ON public.portfolio_items;
CREATE POLICY portfolio_items_select ON public.portfolio_items FOR SELECT USING (public.can_view_profile_extras(user_id));

-- ── 6. my own account state (restriction flags, forced password reset) ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_account_state()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'trust_score', p.trust_score,
    'restriction_flags', COALESCE(p.restriction_flags, '{}'::text[]),
    'shadow_banned_at', p.shadow_banned_at,
    'is_shadowbanned', COALESCE(p.is_shadowbanned, false),
    'force_password_reset', COALESCE(p.force_password_reset, false))
  FROM public.profiles p WHERE p.id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_my_account_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_account_state() TO authenticated;

-- staff: a full snapshot of a profile (used to roll back moderation actions; works after the moderation columns are locked)
CREATE OR REPLACE FUNCTION public.get_profile_snapshot(p_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT CASE WHEN public.is_current_user_internal() THEN to_jsonb(p) ELSE NULL END FROM public.profiles p WHERE p.id = p_id;
$$;
REVOKE ALL ON FUNCTION public.get_profile_snapshot(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_snapshot(uuid) TO authenticated;

COMMIT;
