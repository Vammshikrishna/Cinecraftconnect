-- PART CR - group chat keys can no longer be overwritten by other members (audit step 1f)
-- Run in the Supabase SQL editor AFTER part_cq. Based on the LIVE group_keys policies read in the audit.
--
-- Problem: every member of a room or project space could UPDATE every other member's wrapped key. A malicious member
-- could replace a victim's key with garbage (the victim then cannot read the chat and the app never repairs it) or with
-- a key the attacker knows. Staff with an audited-access grant could do the same, and could insert keys for anyone.
--
-- After this part:
--   * you can update only YOUR OWN key row (staff with a grant: only their own too)
--   * members can still add the key for someone who has none yet (that is how a new member receives the key)
--   * nobody can insert a key row for a room or space they do not belong to
--   * you can still delete your own key row (a person who cannot decrypt can reset it and have a member re-wrap it)
-- The web and mobile apps only start using a new key after saving it succeeds, so when an overwrite is refused the
-- app keeps the key it already had instead of switching to one nobody else holds.

-- 1. Only your own row can be updated.
DROP POLICY IF EXISTS "Users can update group keys" ON public.group_keys;
CREATE POLICY "Users can update group keys" ON public.group_keys
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. Staff with an active access grant: their own row only.
DROP POLICY IF EXISTS "Staff with active grants can update group keys" ON public.group_keys;
CREATE POLICY "Staff with active grants can update group keys" ON public.group_keys
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.space_access_grants g
                WHERE g.user_id = auth.uid() AND g.target_id = (group_keys.target_id)::text AND g.expires_at > now())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.space_access_grants g
                WHERE g.user_id = auth.uid() AND g.target_id = (group_keys.target_id)::text AND g.expires_at > now())
  );

DROP POLICY IF EXISTS "Staff with active grants can insert group keys" ON public.group_keys;
CREATE POLICY "Staff with active grants can insert group keys" ON public.group_keys
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.space_access_grants
                WHERE space_access_grants.user_id = auth.uid()
                  AND (space_access_grants.target_id)::uuid = group_keys.target_id
                  AND space_access_grants.expires_at > now())
  );

-- 3. Members can add a key for a member who has none, but only for a room / space they belong to
--    (the old policy also let anyone insert their own row for any room).
DROP POLICY IF EXISTS "Users can insert group keys for others if they are members" ON public.group_keys;
CREATE POLICY "Users can insert group keys for others if they are members" ON public.group_keys
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.project_space_members
            WHERE project_space_members.project_space_id = group_keys.target_id
              AND project_space_members.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.project_spaces
               LEFT JOIN public.projects ON project_spaces.project_id = projects.id
               WHERE project_spaces.id = group_keys.target_id
                 AND (project_spaces.creator_id = auth.uid() OR projects.creator_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM public.room_members
               WHERE room_members.room_id = group_keys.target_id AND room_members.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.discussion_rooms
               WHERE discussion_rooms.id = group_keys.target_id AND discussion_rooms.creator_id = auth.uid())
  );
