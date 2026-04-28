-- ============================================================
-- 17_admin_god_mode_policies.sql
-- CineCraft Connect — Admin God Mode & Global Management
-- ============================================================

-- 1. Posts (Social Engine)
DROP POLICY IF EXISTS "Admins can manage all posts" ON public.posts;
CREATE POLICY "Admins can manage all posts" ON public.posts
  FOR ALL USING (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

-- 2. Comments (Social Engine)
DROP POLICY IF EXISTS "Admins can manage all comments" ON public.comments;
CREATE POLICY "Admins can manage all comments" ON public.comments
  FOR ALL USING (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

-- 3. Project Spaces (Project Architecture)
DROP POLICY IF EXISTS "Admins can manage all project spaces" ON public.project_spaces;
CREATE POLICY "Admins can manage all project spaces" ON public.project_spaces
  FOR ALL USING (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

-- 4. Jobs (Talent Network)
DROP POLICY IF EXISTS "Admins can manage all jobs" ON public.jobs;
CREATE POLICY "Admins can manage all jobs" ON public.jobs
  FOR ALL USING (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

-- 5. Marketplace Listings (Marketplace Hub)
DROP POLICY IF EXISTS "Admins can manage all listings" ON public.marketplace_listings;
CREATE POLICY "Admins can manage all listings" ON public.marketplace_listings
  FOR ALL USING (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

-- 6. Discussion Rooms (Communication Layer)
DROP POLICY IF EXISTS "Admins can manage all discussion rooms" ON public.discussion_rooms;
CREATE POLICY "Admins can manage all discussion rooms" ON public.discussion_rooms
  FOR ALL USING (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

-- 7. Room Messages (Communication Layer)
DROP POLICY IF EXISTS "Admins can manage all room messages" ON public.room_messages;
CREATE POLICY "Admins can manage all room messages" ON public.room_messages
  FOR ALL USING (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

-- 8. Messages (Direct Messaging)
DROP POLICY IF EXISTS "Admins can manage all messages" ON public.messages;
CREATE POLICY "Admins can manage all messages" ON public.messages
  FOR ALL USING (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

-- 9. Profiles (Core Identity)
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL USING (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );
