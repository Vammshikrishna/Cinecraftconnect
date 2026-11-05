-- ROLLBACK for part_cl. Only run this AFTER part_cl has been applied and caused a problem.
-- (Safe to run twice; running it before part_cl changes nothing important.)
-- ROLLBACK for part_cl (policies, grants and notification rule only).
-- Use ONLY if calls, project membership or notifications stop working after part_cl and you need the old behaviour back
-- while we fix it. This re-opens the holes the audit found. The new functions in part_cl are safe to leave in place.

-- calls / call_participants: back to the old open policies and table grants
DROP POLICY IF EXISTS "Members can view their calls" ON public.calls;
DROP POLICY IF EXISTS "Members can start calls in their rooms" ON public.calls;
DROP POLICY IF EXISTS "Members can end their calls" ON public.calls;
DROP POLICY IF EXISTS "Members can view participants of their calls" ON public.call_participants;
DROP POLICY IF EXISTS "Members can add themselves to their calls" ON public.call_participants;
DROP POLICY IF EXISTS "Members can update their own call row" ON public.call_participants;

GRANT INSERT, UPDATE, DELETE ON public.calls TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.call_participants TO anon, authenticated;

DROP POLICY IF EXISTS "Allow authenticated users to select calls" ON public.calls;
CREATE POLICY "Allow authenticated users to select calls" ON public.calls FOR SELECT USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "Allow authenticated users to insert calls" ON public.calls;
CREATE POLICY "Allow authenticated users to insert calls" ON public.calls FOR INSERT WITH CHECK (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "Allow authenticated users to update calls" ON public.calls;
CREATE POLICY "Allow authenticated users to update calls" ON public.calls FOR UPDATE USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "Allow authenticated users to delete calls" ON public.calls;
CREATE POLICY "Allow authenticated users to delete calls" ON public.calls FOR DELETE USING (auth.role() = 'authenticated'::text);

DROP POLICY IF EXISTS "Allow authenticated users to select call participants" ON public.call_participants;
CREATE POLICY "Allow authenticated users to select call participants" ON public.call_participants FOR SELECT USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "Allow authenticated users to insert call participants" ON public.call_participants;
CREATE POLICY "Allow authenticated users to insert call participants" ON public.call_participants FOR INSERT WITH CHECK (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "Allow authenticated users to update call participants" ON public.call_participants;
CREATE POLICY "Allow authenticated users to update call participants" ON public.call_participants FOR UPDATE USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "Allow authenticated users to delete call participants" ON public.call_participants;
CREATE POLICY "Allow authenticated users to delete call participants" ON public.call_participants FOR DELETE USING (auth.role() = 'authenticated'::text);

-- project_space_members: back to "anyone can insert themselves"
DROP POLICY IF EXISTS "Owners add members; approved requesters join" ON public.project_space_members;
DROP POLICY IF EXISTS "Users can insert themselves into project members" ON public.project_space_members;
CREATE POLICY "Users can insert themselves into project members" ON public.project_space_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- notifications: back to the old rule
DROP POLICY IF EXISTS "Authenticated users can notify with their own name" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Authenticated users can create notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK ((trigger_user_id IS NULL) OR (trigger_user_id = auth.uid()));
