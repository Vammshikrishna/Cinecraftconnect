-- Company pages, missing features: team invitations, admin roles, follower list, follower notifications.
-- Run AFTER part T. Safe to re-run.
--   * Nobody is added to a team without agreeing: owners / admins send an invitation, the person accepts or declines.
--   * The owner assigns page admin roles (super_admin / content_admin / analyst) to accepted team members.
--   * People can leave a team. Managers can see who follows the page.
--   * Followers are notified when the page posts or opens a job.

-- ── invitations ───────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_page_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.company_pages(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text,
  department text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_page_invites_pending ON public.company_page_invites (page_id, invitee_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_page_invites_invitee ON public.company_page_invites (invitee_id, status);
ALTER TABLE public.company_page_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Invitee or managers read invites" ON public.company_page_invites;
CREATE POLICY "Invitee or managers read invites" ON public.company_page_invites FOR SELECT TO authenticated
  USING (invitee_id = auth.uid() OR public.is_page_manager(page_id, auth.uid()));
-- no write policies: everything goes through the functions below

-- team members are only added through an accepted invitation now
DROP POLICY IF EXISTS "Admins can add members" ON public.company_page_members;

CREATE OR REPLACE FUNCTION public.invite_to_page(p_page_id uuid, p_user_id uuid, p_title text, p_department text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_page company_pages%ROWTYPE;
  v_id uuid;
BEGIN
  IF v_uid IS NULL OR NOT public.is_page_manager(p_page_id, v_uid) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not allowed');
  END IF;
  SELECT * INTO v_page FROM company_pages WHERE id = p_page_id;
  IF p_user_id = v_page.owner_id OR p_user_id = v_uid THEN
    RETURN jsonb_build_object('success', false, 'message', 'That person already runs this page');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Person not found');
  END IF;
  IF EXISTS (SELECT 1 FROM company_page_members WHERE page_id = p_page_id AND user_id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Already on the team');
  END IF;
  IF EXISTS (SELECT 1 FROM company_page_invites WHERE page_id = p_page_id AND invitee_id = p_user_id AND status = 'pending') THEN
    RETURN jsonb_build_object('success', false, 'message', 'An invitation is already waiting for a reply');
  END IF;
  IF (SELECT count(*) FROM company_page_invites WHERE page_id = p_page_id AND status = 'pending') >= 50 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Too many pending invitations');
  END IF;

  INSERT INTO company_page_invites (page_id, invitee_id, invited_by, title, department)
  VALUES (p_page_id, p_user_id, v_uid, NULLIF(left(trim(COALESCE(p_title, '')), 80), ''), NULLIF(left(trim(COALESCE(p_department, '')), 80), ''))
  RETURNING id INTO v_id;

  INSERT INTO notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
  VALUES (p_user_id, v_uid, 'page_invite', 'Team invitation',
          v_page.name || ' invited you to join their team' || CASE WHEN NULLIF(trim(COALESCE(p_title, '')), '') IS NOT NULL THEN ' as ' || trim(p_title) ELSE '' END || '.',
          '/pages/' || v_page.slug, p_page_id, false);

  RETURN jsonb_build_object('success', true, 'invite_id', v_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.invite_to_page(uuid, uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_page_invite(p_invite_id uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inv company_page_invites%ROWTYPE;
  v_page company_pages%ROWTYPE;
BEGIN
  SELECT * INTO v_inv FROM company_page_invites WHERE id = p_invite_id;
  IF v_inv.id IS NULL OR v_uid IS NULL OR v_inv.invitee_id <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invitation not found');
  END IF;
  IF v_inv.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'This invitation was already answered or withdrawn');
  END IF;
  SELECT * INTO v_page FROM company_pages WHERE id = v_inv.page_id;

  UPDATE company_page_invites SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END, responded_at = now() WHERE id = p_invite_id;

  IF p_accept THEN
    INSERT INTO company_page_members (page_id, user_id, title, department)
    VALUES (v_inv.page_id, v_uid, COALESCE(v_inv.title, 'Team Member'), COALESCE(v_inv.department, 'General'))
    ON CONFLICT (page_id, user_id) DO NOTHING;
  END IF;

  INSERT INTO notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
  VALUES (v_inv.invited_by, v_uid, 'page_invite_reply',
          CASE WHEN p_accept THEN 'Invitation accepted' ELSE 'Invitation declined' END,
          (SELECT COALESCE(full_name, username, 'Someone') FROM profiles WHERE id = v_uid)
            || CASE WHEN p_accept THEN ' joined ' ELSE ' declined to join ' END || v_page.name || '.',
          '/pages/' || v_page.slug, v_inv.page_id, false);

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.respond_page_invite(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_page_invite(p_invite_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inv company_page_invites%ROWTYPE;
BEGIN
  SELECT * INTO v_inv FROM company_page_invites WHERE id = p_invite_id;
  IF v_inv.id IS NULL OR NOT public.is_page_manager(v_inv.page_id, auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not allowed');
  END IF;
  UPDATE company_page_invites SET status = 'cancelled', responded_at = now() WHERE id = p_invite_id AND status = 'pending';
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.cancel_page_invite(uuid) TO authenticated;

-- ── leaving a team ────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.leave_page_team(p_page_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'Please sign in'); END IF;
  IF EXISTS (SELECT 1 FROM company_pages WHERE id = p_page_id AND owner_id = v_uid) THEN
    RETURN jsonb_build_object('success', false, 'message', 'The owner cannot leave the page. Delete it or transfer it instead.');
  END IF;
  DELETE FROM company_page_admins WHERE page_id = p_page_id AND user_id = v_uid;
  DELETE FROM company_page_members WHERE page_id = p_page_id AND user_id = v_uid;
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.leave_page_team(uuid) TO authenticated;

-- ── admin roles (owner only, for people already on the team) ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_page_admin(p_page_id uuid, p_user_id uuid, p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_page company_pages%ROWTYPE;
BEGIN
  SELECT * INTO v_page FROM company_pages WHERE id = p_page_id;
  IF v_page.id IS NULL OR v_uid IS NULL OR v_page.owner_id <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'message', 'Only the owner can change roles');
  END IF;
  IF p_user_id = v_page.owner_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'The owner always has full access');
  END IF;
  IF p_role IS NULL OR p_role = 'member' THEN
    DELETE FROM company_page_admins WHERE page_id = p_page_id AND user_id = p_user_id;
    RETURN jsonb_build_object('success', true);
  END IF;
  IF p_role NOT IN ('super_admin', 'content_admin', 'analyst') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unknown role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM company_page_members WHERE page_id = p_page_id AND user_id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Only people on the team can be given a role');
  END IF;
  INSERT INTO company_page_admins (page_id, user_id, role) VALUES (p_page_id, p_user_id, p_role)
  ON CONFLICT (page_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
  VALUES (p_user_id, v_uid, 'page_role', 'Your role changed',
          'You are now ' || replace(p_role, '_', ' ') || ' of ' || v_page.name || '.', '/pages/' || v_page.slug, p_page_id, false);
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_page_admin(uuid, uuid, text) TO authenticated;

-- a member who is removed from the team loses their admin role too
CREATE OR REPLACE FUNCTION public.drop_admin_on_member_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM company_page_admins
  WHERE page_id = OLD.page_id AND user_id = OLD.user_id
    AND user_id <> (SELECT owner_id FROM company_pages WHERE id = OLD.page_id);
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_drop_admin_on_member_removal ON public.company_page_members;
CREATE TRIGGER trg_drop_admin_on_member_removal AFTER DELETE ON public.company_page_members
  FOR EACH ROW EXECUTE FUNCTION public.drop_admin_on_member_removal();

-- ── who follows (managers only) ───────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.page_followers(p_page_id uuid)
RETURNS TABLE(user_id uuid, full_name text, username text, avatar_url text, followed_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_page_manager(p_page_id, auth.uid()) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT f.user_id, p.full_name, p.username, p.avatar_url, f.created_at
  FROM company_page_followers f JOIN profiles p ON p.id = f.user_id
  WHERE f.page_id = p_page_id
  ORDER BY f.created_at DESC
  LIMIT 200;
END;
$$;
GRANT EXECUTE ON FUNCTION public.page_followers(uuid) TO authenticated;

-- ── notify followers ──────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_followers_of_page_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_page company_pages%ROWTYPE;
BEGIN
  IF NEW.page_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_page FROM company_pages WHERE id = NEW.page_id;
  IF v_page.id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
  SELECT f.user_id, NEW.author_id, 'page_post', v_page.name || ' posted',
         left(COALESCE(NEW.content, ''), 120), '/pages/' || v_page.slug, NEW.page_id, false
  FROM company_page_followers f
  WHERE f.page_id = NEW.page_id AND f.user_id <> NEW.author_id
  LIMIT 500;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_followers_of_page_post ON public.posts;
CREATE TRIGGER trg_notify_followers_of_page_post AFTER INSERT ON public.posts
  FOR EACH ROW WHEN (NEW.page_id IS NOT NULL) EXECUTE FUNCTION public.notify_followers_of_page_post();

CREATE OR REPLACE FUNCTION public.notify_followers_of_page_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_page company_pages%ROWTYPE;
BEGIN
  IF NEW.page_id IS NULL OR NEW.is_active IS NOT TRUE OR NEW.is_draft THEN RETURN NEW; END IF;
  -- only when the job BECOMES visible
  IF TG_OP = 'UPDATE' AND OLD.is_active IS TRUE AND OLD.is_draft = false THEN RETURN NEW; END IF;
  SELECT * INTO v_page FROM company_pages WHERE id = NEW.page_id;
  IF v_page.id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
  SELECT f.user_id, NEW.posted_by, 'page_job', v_page.name || ' is hiring', NEW.title, '/jobs/' || NEW.id::text, NEW.id, false
  FROM company_page_followers f
  WHERE f.page_id = NEW.page_id AND f.user_id <> NEW.posted_by
  LIMIT 500;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_followers_of_page_job ON public.jobs;
CREATE TRIGGER trg_notify_followers_of_page_job AFTER INSERT OR UPDATE OF is_active, is_draft ON public.jobs
  FOR EACH ROW WHEN (NEW.page_id IS NOT NULL) EXECUTE FUNCTION public.notify_followers_of_page_job();
