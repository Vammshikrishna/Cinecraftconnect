-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- part_bw: gifts from the team to users
--
-- A super admin sends a gift: a plan for some days, or one feature or a higher limit for some days, with a personal
-- message. It lands in the person's account like a gift card: they get a notification, open it, and press Accept. No code
-- to type. It can go to specific people (usernames), to everybody, or to a group (account type, verified, joined after).
--
--   * Free during the beta: a gift accepted now is remembered, and its days start counting when billing goes live, so
--     nobody burns a gift while everything is free anyway.
--   * A gift becomes ordinary entitlement overrides (part BV), so nothing else in the app needs a special case.
--   * Staff accounts and banned accounts never receive gifts. Every send is written to the audit ledger.
--
-- Run after part_bv. Safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.gifts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      uuid NOT NULL,
  recipient_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_name     text NOT NULL DEFAULT 'The CineCraft team',
  message       text,
  kind          text NOT NULL CHECK (kind IN ('plan', 'feature')),
  plan_code     text REFERENCES public.plans(code),
  feature_key   text,
  feature_value jsonb,
  days          integer NOT NULL CHECK (days BETWEEN 1 AND 730),
  status        text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'opened', 'accepted', 'declined', 'expired')),
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  opened_at     timestamptz,
  accepted_at   timestamptz,
  applied_at    timestamptz,                         -- when the days started counting (at once when live, at go-live when accepted in beta)
  expires_at    timestamptz NOT NULL,                -- the last moment to accept it
  CONSTRAINT gift_shape CHECK (
    (kind = 'plan' AND plan_code IS NOT NULL) OR (kind = 'feature' AND feature_key IS NOT NULL AND feature_value IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS gifts_recipient ON public.gifts (recipient_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS gifts_batch ON public.gifts (batch_id);

ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gifts_read_own ON public.gifts;
CREATE POLICY gifts_read_own ON public.gifts FOR SELECT TO authenticated USING (recipient_id = auth.uid());
-- no write policies: gifts are created and answered only through the functions below


-- ── who would receive it ────────────────────────────────────────────────────────────────────────
-- p_filter: {"all": true} or any of {"account_types": ["creator","studio"], "verified": true, "joined_after": "2026-01-01"}
-- p_usernames: specific people (used instead of the filter when given)
CREATE OR REPLACE FUNCTION public._gift_recipients(p_filter jsonb, p_usernames text[])
RETURNS TABLE (id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE NOT public.is_staff_user(p.id)
    AND COALESCE(p.is_banned, false) = false
    AND (
      CASE
        WHEN p_usernames IS NOT NULL AND cardinality(p_usernames) > 0 THEN lower(p.username) = ANY (SELECT lower(trim(both '@ ' from u)) FROM unnest(p_usernames) u)
        WHEN COALESCE((p_filter ->> 'all')::boolean, false) THEN true
        ELSE
          (NOT (p_filter ? 'account_types') OR COALESCE(p.account_type, 'creator') = ANY (SELECT jsonb_array_elements_text(p_filter -> 'account_types')))
          AND (NOT (p_filter ? 'verified') OR COALESCE(p.is_verified, false) = COALESCE((p_filter ->> 'verified')::boolean, false))
          AND (NOT (p_filter ? 'joined_after') OR (SELECT u.created_at FROM auth.users u WHERE u.id = p.id) >= (p_filter ->> 'joined_after')::date)   -- profiles has no created_at, so the sign-up date comes from the account itself
          AND ((p_filter ? 'account_types') OR (p_filter ? 'verified') OR (p_filter ? 'joined_after'))   -- an empty filter means nobody, never everybody
      END
    );
$$;
REVOKE ALL ON FUNCTION public._gift_recipients(jsonb, text[]) FROM PUBLIC;

-- the number and a few names, shown before anything is sent
CREATE OR REPLACE FUNCTION public.staff_gift_audience(p_filter jsonb DEFAULT '{}'::jsonb, p_usernames text[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_sample jsonb;
  v_missing text[];
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can send gifts';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;

  SELECT count(*)::int INTO v_total FROM public._gift_recipients(p_filter, p_usernames);
  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', COALESCE(pr.full_name, pr.username), 'username', pr.username)), '[]'::jsonb) INTO v_sample
  FROM (SELECT p.* FROM public.profiles p WHERE p.id IN (SELECT id FROM public._gift_recipients(p_filter, p_usernames)) ORDER BY p.updated_at DESC NULLS LAST LIMIT 5) pr;

  IF p_usernames IS NOT NULL AND cardinality(p_usernames) > 0 THEN
    SELECT COALESCE(array_agg(u), '{}') INTO v_missing
    FROM unnest(p_usernames) u
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.username) = lower(trim(both '@ ' from u)) AND NOT public.is_staff_user(p.id));
  END IF;

  RETURN jsonb_build_object('total', v_total, 'sample', v_sample, 'not_found', COALESCE(to_jsonb(v_missing), '[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_gift_audience(jsonb, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_gift_audience(jsonb, text[]) TO authenticated;


-- ── sending ─────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_send_gift(
  p_kind text, p_plan_code text, p_feature_key text, p_feature_value jsonb, p_days integer,
  p_from_name text, p_message text, p_accept_within_days integer,
  p_filter jsonb DEFAULT '{}'::jsonb, p_usernames text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch uuid := gen_random_uuid();
  v_sent integer;
  v_title text;
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can send gifts';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  IF p_kind NOT IN ('plan', 'feature') THEN
    RAISE EXCEPTION 'A gift is a plan or a feature';
  END IF;
  IF p_days < 1 OR p_days > 730 OR p_accept_within_days < 1 OR p_accept_within_days > 365 THEN
    RAISE EXCEPTION 'Choose 1 to 730 days of gift, and 1 to 365 days to accept it';
  END IF;
  IF p_kind = 'plan' AND NOT EXISTS (SELECT 1 FROM public.plans WHERE code = p_plan_code AND audience = 'person') THEN
    RAISE EXCEPTION 'Unknown personal plan';
  END IF;
  IF p_kind = 'feature' AND (COALESCE(trim(p_feature_key), '') = '' OR p_feature_value IS NULL) THEN
    RAISE EXCEPTION 'Choose the feature and its value';
  END IF;

  INSERT INTO public.gifts (batch_id, recipient_id, from_name, message, kind, plan_code, feature_key, feature_value, days, created_by, expires_at)
  SELECT v_batch, r.id, COALESCE(NULLIF(trim(p_from_name), ''), 'The CineCraft team'), NULLIF(left(trim(COALESCE(p_message, '')), 600), ''),
         p_kind, CASE WHEN p_kind = 'plan' THEN p_plan_code END, CASE WHEN p_kind = 'feature' THEN p_feature_key END,
         CASE WHEN p_kind = 'feature' THEN p_feature_value END, p_days, auth.uid(), now() + make_interval(days => p_accept_within_days)
  FROM public._gift_recipients(p_filter, p_usernames) r
  LIMIT 50000;
  GET DIAGNOSTICS v_sent = ROW_COUNT;

  IF v_sent = 0 THEN
    RAISE EXCEPTION 'Nobody matches, so nothing was sent';
  END IF;

  v_title := 'A gift from ' || COALESCE(NULLIF(trim(p_from_name), ''), 'the CineCraft team');
  INSERT INTO public.notifications (user_id, title, message, type, priority, action_url)
  SELECT g.recipient_id, v_title, COALESCE(left(g.message, 120), 'Open it to see what is inside.'), 'gift_received', 'high', '/gifts'
  FROM public.gifts g WHERE g.batch_id = v_batch;

  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('billing.gift_sent', auth.uid(), v_batch::text, 'gift_batch', left(COALESCE(p_message, 'Gift sent'), 200),
          jsonb_build_object('kind', p_kind, 'plan', p_plan_code, 'feature', p_feature_key, 'days', p_days, 'recipients', v_sent,
                             'filter', p_filter, 'usernames', COALESCE(cardinality(p_usernames), 0)));

  RETURN jsonb_build_object('batch_id', v_batch, 'sent', v_sent);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_send_gift(text, text, text, jsonb, integer, text, text, integer, jsonb, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_send_gift(text, text, text, jsonb, integer, text, text, integer, jsonb, text[]) TO authenticated;

-- what was sent, and how it went
CREATE OR REPLACE FUNCTION public.staff_list_gift_batches()
RETURNS TABLE (batch_id uuid, from_name text, kind text, label text, days integer, sent integer, opened integer, accepted integer, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can see gifts';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  RETURN QUERY
  SELECT g.batch_id, max(g.from_name), max(g.kind), max(COALESCE(pl.name, g.feature_key)), max(g.days),
         count(*)::int,
         count(*) FILTER (WHERE g.status IN ('opened', 'accepted'))::int,
         count(*) FILTER (WHERE g.status = 'accepted')::int,
         min(g.created_at)
  FROM public.gifts g
  LEFT JOIN public.plans pl ON pl.code = g.plan_code
  GROUP BY g.batch_id
  ORDER BY min(g.created_at) DESC
  LIMIT 50;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_list_gift_batches() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_list_gift_batches() TO authenticated;


-- ── receiving ───────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_gifts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', g.id, 'from_name', g.from_name, 'message', g.message, 'kind', g.kind,
      'label', COALESCE(pl.name, g.feature_key), 'feature_key', g.feature_key, 'feature_value', g.feature_value,
      'days', g.days,
      'status', CASE WHEN g.status IN ('sent', 'opened') AND g.expires_at <= now() THEN 'expired' ELSE g.status END,
      'created_at', g.created_at, 'expires_at', g.expires_at, 'accepted_at', g.accepted_at, 'applied_at', g.applied_at
    ) ORDER BY g.created_at DESC)
    FROM public.gifts g
    LEFT JOIN public.plans pl ON pl.code = g.plan_code
    WHERE g.recipient_id = auth.uid() AND g.status <> 'declined'
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.my_gifts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_gifts() TO authenticated;

CREATE OR REPLACE FUNCTION public.open_gift(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.gifts SET status = 'opened', opened_at = now()
   WHERE id = p_id AND recipient_id = auth.uid() AND status = 'sent';
$$;
REVOKE ALL ON FUNCTION public.open_gift(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_gift(uuid) TO authenticated;

-- turns one accepted gift into entitlement overrides that last for its days, starting now
CREATE OR REPLACE FUNCTION public._apply_gift(p_gift_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g public.gifts%ROWTYPE;
  v_until timestamptz;
BEGIN
  SELECT * INTO g FROM public.gifts WHERE id = p_gift_id FOR UPDATE;
  IF NOT FOUND OR g.status <> 'accepted' OR g.applied_at IS NOT NULL THEN RETURN; END IF;
  v_until := now() + make_interval(days => g.days);

  IF g.kind = 'plan' THEN
    INSERT INTO public.entitlement_overrides (owner_type, owner_id, key, value, reason, expires_at, granted_by)
    SELECT 'user', g.recipient_id, pe.key, pe.value, 'Gift ' || g.id::text, v_until, g.created_by
    FROM public.plan_entitlements pe WHERE pe.plan_code = g.plan_code;
  ELSE
    INSERT INTO public.entitlement_overrides (owner_type, owner_id, key, value, reason, expires_at, granted_by)
    VALUES ('user', g.recipient_id, g.feature_key, g.feature_value, 'Gift ' || g.id::text, v_until, g.created_by);
  END IF;

  UPDATE public.gifts SET applied_at = now() WHERE id = g.id;
END;
$$;
REVOKE ALL ON FUNCTION public._apply_gift(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.accept_gift(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g public.gifts%ROWTYPE;
  v_live boolean := public.billing_mode() = 'live';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to accept a gift';
  END IF;
  SELECT * INTO g FROM public.gifts WHERE id = p_id AND recipient_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gift not found';
  END IF;
  IF g.status = 'accepted' THEN
    RETURN jsonb_build_object('status', 'accepted', 'starts_when_live', g.applied_at IS NULL);
  END IF;
  IF g.status NOT IN ('sent', 'opened') OR g.expires_at <= now() THEN
    RAISE EXCEPTION 'This gift is no longer available';
  END IF;
  IF public.is_staff_user(auth.uid()) THEN
    RAISE EXCEPTION 'Staff accounts do not receive gifts';
  END IF;

  UPDATE public.gifts SET status = 'accepted', accepted_at = now(), opened_at = COALESCE(opened_at, now()) WHERE id = p_id;
  -- live: the days start now. Beta: the gift is kept, and its days start when billing goes live.
  IF v_live THEN
    PERFORM public._apply_gift(p_id);
  END IF;
  RETURN jsonb_build_object('status', 'accepted', 'starts_when_live', NOT v_live);
END;
$$;
REVOKE ALL ON FUNCTION public.accept_gift(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_gift(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.decline_gift(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.gifts SET status = 'declined' WHERE id = p_id AND recipient_id = auth.uid() AND status IN ('sent', 'opened');
$$;
REVOKE ALL ON FUNCTION public.decline_gift(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decline_gift(uuid) TO authenticated;


-- ── when billing goes live, the gifts accepted during the beta start counting ───────────────────
CREATE OR REPLACE FUNCTION public.activate_beta_gifts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NEW.key = 'billing_mode' AND NEW.value = '"live"'::jsonb THEN
    FOR v_id IN SELECT id FROM public.gifts WHERE status = 'accepted' AND applied_at IS NULL LOOP
      PERFORM public._apply_gift(v_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS activate_beta_gifts ON public.platform_settings;
CREATE TRIGGER activate_beta_gifts
AFTER INSERT OR UPDATE ON public.platform_settings
FOR EACH ROW EXECUTE FUNCTION public.activate_beta_gifts();


-- ── check ───────────────────────────────────────────────────────────────────────────────────────
-- As a super admin: Billing tab → Send a gift → preview the audience → send. As the recipient: a "A gift from ..." notification
-- opens /gifts; Accept. In beta the card says the days start when plans begin. After "Go live" the days start counting.
