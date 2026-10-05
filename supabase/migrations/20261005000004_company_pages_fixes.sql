-- Company pages: security fixes and bug fixes. Run AFTER part Q (uses is_market_admin / market_is_system). Safe to re-run.
--
--   * Owners could mark their own page verified or set any follower count (the update rule had no column limits).
--   * Anyone could publish a post as ANY company page (the post insert rule only checked the author).
--   * The follower counter never changed (its trigger could not update the page).
--   * Team members (just a name on the page) counted as managers: they could edit posts of the page and, through the
--     jobs rules, read applicants and CVs. Managers are now the owner and page admins (super_admin / content_admin).
--   * The page admin roles existed but could not do anything. Admins can now edit the page and manage the team.
--   * The page address (slug) is fixed once created so shared links do not break.

-- ── who manages a page ────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_page_manager(p_page_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_page_id IS NOT NULL AND p_user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM company_pages cp WHERE cp.id = p_page_id AND cp.owner_id = p_user_id)
    OR EXISTS (SELECT 1 FROM company_page_admins a
               WHERE a.page_id = p_page_id AND a.user_id = p_user_id AND a.role IN ('super_admin', 'content_admin'))
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_page_manager(uuid, uuid) TO authenticated, service_role;

-- ── protected page columns ────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.company_pages_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.market_is_system() OR public.is_market_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_verified := false;
    NEW.follower_count := 0;
  ELSE
    NEW.is_verified := OLD.is_verified;
    NEW.follower_count := OLD.follower_count;
    NEW.owner_id := OLD.owner_id;
    NEW.slug := OLD.slug;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_company_pages_guard ON public.company_pages;
CREATE TRIGGER trg_company_pages_guard BEFORE INSERT OR UPDATE ON public.company_pages
  FOR EACH ROW EXECUTE FUNCTION public.company_pages_guard();

-- page admins (super_admin / content_admin) can edit the page; the owner keeps their own rule
DROP POLICY IF EXISTS "Page managers can update pages" ON public.company_pages;
CREATE POLICY "Page managers can update pages" ON public.company_pages FOR UPDATE TO authenticated
  USING (public.is_page_manager(id, auth.uid()))
  WITH CHECK (public.is_page_manager(id, auth.uid()));

-- team management: managers only (the old rule let any admin row, including analysts, do it)
DROP POLICY IF EXISTS "Admins can add members" ON public.company_page_members;
CREATE POLICY "Admins can add members" ON public.company_page_members FOR INSERT TO authenticated
  WITH CHECK (public.is_page_manager(page_id, auth.uid()));
DROP POLICY IF EXISTS "Admins can remove members" ON public.company_page_members;
CREATE POLICY "Admins can remove members" ON public.company_page_members FOR DELETE TO authenticated
  USING (public.is_page_manager(page_id, auth.uid()) OR user_id = auth.uid());   -- people can also leave a team

-- ── follower counter ──────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_page_follower_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.market_system', '1', true);
  IF TG_OP = 'INSERT' THEN
    UPDATE company_pages SET follower_count = follower_count + 1 WHERE id = NEW.page_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE company_pages SET follower_count = GREATEST(0, follower_count - 1) WHERE id = OLD.page_id;
  END IF;
  PERFORM set_config('app.market_system', '', true);
  RETURN NULL;
END;
$$;

-- one-time repair of the counts that were never updated
DO $$
BEGIN
  PERFORM set_config('app.market_system', '1', true);
  UPDATE public.company_pages p
  SET follower_count = (SELECT count(*) FROM public.company_page_followers f WHERE f.page_id = p.id);
  PERFORM set_config('app.market_system', '', true);
END;
$$;

-- ── posting as a page ─────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.posts_check_page_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.page_id IS NULL OR public.market_is_system() OR public.is_market_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.page_id IS NOT DISTINCT FROM OLD.page_id THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_page_manager(NEW.page_id, auth.uid()) THEN
    RAISE EXCEPTION 'You can only post as a page you manage' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_posts_check_page_author ON public.posts;
CREATE TRIGGER trg_posts_check_page_author BEFORE INSERT OR UPDATE OF page_id ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.posts_check_page_author();

-- editing / deleting a page's posts: managers only (team members could before)
DROP POLICY IF EXISTS "Page managers can update page posts" ON public.posts;
CREATE POLICY "Page managers can update page posts" ON public.posts FOR UPDATE TO authenticated
  USING (page_id IS NOT NULL AND public.is_page_manager(page_id, auth.uid()))
  WITH CHECK (page_id IS NOT NULL AND public.is_page_manager(page_id, auth.uid()));
DROP POLICY IF EXISTS "Page managers can delete page posts" ON public.posts;
CREATE POLICY "Page managers can delete page posts" ON public.posts FOR DELETE TO authenticated
  USING (page_id IS NOT NULL AND public.is_page_manager(page_id, auth.uid()));
