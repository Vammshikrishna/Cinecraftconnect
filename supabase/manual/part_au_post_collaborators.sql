-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Part AU – Collaborators on posts
--   The author of a post can credit up to 5 other people ("with @sam and @ria"). A person is credited only after they
--   accept: they get a notification and can accept or decline on the post. Anyone can remove themselves later.
--   * the table has row-level security on and no policies/grants: everything goes through the functions below
--   * a person who blocked the author (or was blocked by them) cannot be invited
--   * credits are only shown to people who can see the post (audience from part AR is respected)
-- Run after part AT, then deploy the new web + mobile builds. See docs/POST_EXTRAS.md.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE TABLE IF NOT EXISTS public.post_collaborators (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_post_collaborators_user ON public.post_collaborators (user_id, status);

ALTER TABLE public.post_collaborators ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.post_collaborators FROM anon, authenticated, PUBLIC;

-- ── invite (author only, up to 5 people in total) ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.invite_post_collaborators(p_post uuid, p_users uuid[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_author uuid;
  v_name text;
  v_existing int;
  v_added int := 0;
  v_u uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  SELECT author_id INTO v_author FROM public.posts WHERE id = p_post;
  IF NOT FOUND OR v_author IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only add collaborators to your own post' USING ERRCODE = 'P0001';
  END IF;
  SELECT COALESCE(full_name, username, 'Someone') INTO v_name FROM public.profiles WHERE id = auth.uid();
  SELECT count(*) INTO v_existing FROM public.post_collaborators WHERE post_id = p_post AND status <> 'declined';

  FOREACH v_u IN ARRAY COALESCE(p_users, ARRAY[]::uuid[]) LOOP
    EXIT WHEN v_existing + v_added >= 5;
    CONTINUE WHEN v_u IS NULL OR v_u = auth.uid();
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_u);
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.blocked_users b
       WHERE (b.user_id = v_u AND b.blocked_user_id = auth.uid()) OR (b.user_id = auth.uid() AND b.blocked_user_id = v_u)
    );
    INSERT INTO public.post_collaborators (post_id, user_id, invited_by) VALUES (p_post, v_u, auth.uid())
    ON CONFLICT (post_id, user_id) DO NOTHING;
    IF FOUND THEN
      v_added := v_added + 1;
      INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
      VALUES (v_u, auth.uid(), 'post_collab_invite', 'Collaboration invite', v_name || ' wants to credit you on a post. Open it to accept or decline.', '/post/' || p_post::text, p_post, false);
    END IF;
  END LOOP;

  IF v_added > 0 THEN
    PERFORM set_config('app.market_system', '1', true);
    UPDATE public.posts SET has_collabs = true WHERE id = p_post;
    PERFORM set_config('app.market_system', '', true);
  END IF;
  RETURN jsonb_build_object('success', true, 'invited', v_added);
END;
$$;

-- ── accept or decline ────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.respond_post_collaboration(p_post uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_inviter uuid;
  v_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  UPDATE public.post_collaborators
     SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END, responded_at = now()
   WHERE post_id = p_post AND user_id = auth.uid() AND status = 'pending'
   RETURNING invited_by INTO v_inviter;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'There is no pending invitation for you on this post' USING ERRCODE = 'P0001';
  END IF;
  IF p_accept THEN
    SELECT COALESCE(full_name, username, 'Someone') INTO v_name FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
    VALUES (v_inviter, auth.uid(), 'post_collab_accepted', 'Collaboration accepted', v_name || ' accepted and is now credited on your post.', '/post/' || p_post::text, p_post, false);
  END IF;
  RETURN jsonb_build_object('success', true, 'accepted', p_accept);
END;
$$;

-- ── remove: the author removes anyone, a collaborator removes themselves ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.remove_post_collaborator(p_post uuid, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_author uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  SELECT author_id INTO v_author FROM public.posts WHERE id = p_post;
  IF NOT FOUND OR (auth.uid() <> v_author AND auth.uid() <> p_user) THEN
    RAISE EXCEPTION 'You cannot remove this collaborator' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM public.post_collaborators WHERE post_id = p_post AND user_id = p_user;
  IF NOT EXISTS (SELECT 1 FROM public.post_collaborators WHERE post_id = p_post AND status <> 'declined') THEN
    PERFORM set_config('app.market_system', '1', true);
    UPDATE public.posts SET has_collabs = false WHERE id = p_post;
    PERFORM set_config('app.market_system', '', true);
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── read (many posts at once) ────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_post_collaborators(p_posts uuid[])
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(jsonb_agg(x.obj), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'post_id', po.id,
      'is_author', (po.author_id = auth.uid()),
      'my_status', (SELECT c.status FROM public.post_collaborators c WHERE c.post_id = po.id AND c.user_id = auth.uid()),
      'accepted', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', pr.id, 'username', pr.username, 'full_name', pr.full_name, 'avatar_url', pr.avatar_url) ORDER BY c.responded_at)
          FROM public.post_collaborators c JOIN public.profiles pr ON pr.id = c.user_id
         WHERE c.post_id = po.id AND c.status = 'accepted'), '[]'::jsonb),
      -- only the author sees who has not answered yet
      'pending', CASE WHEN po.author_id = auth.uid() THEN COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', pr.id, 'username', pr.username, 'full_name', pr.full_name, 'avatar_url', pr.avatar_url))
          FROM public.post_collaborators c JOIN public.profiles pr ON pr.id = c.user_id
         WHERE c.post_id = po.id AND c.status = 'pending'), '[]'::jsonb) ELSE '[]'::jsonb END
    ) AS obj
      FROM public.posts po
     WHERE po.id = ANY (p_posts)
       AND po.has_collabs
       AND public.can_view_post(po.author_id, po.audience)   -- this function bypasses row-level security, so it checks the audience itself
       AND (po.scheduled_at IS NULL OR po.scheduled_at <= now() OR po.author_id = auth.uid())
     LIMIT 50
  ) x;
$$;

REVOKE ALL ON FUNCTION public.invite_post_collaborators(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_post_collaboration(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_post_collaborator(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_post_collaborators(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_post_collaborators(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_post_collaboration(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_post_collaborator(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_post_collaborators(uuid[]) TO authenticated;

COMMIT;
