-- PART FM (rooms, follow-up) - after part FM "room_policies_rebuild" a signed-in person who is not a member can no longer SEE public discussion rooms (GET /rest/v1/discussion_rooms returns an empty list,
-- so the room list and the Join button break for everybody except members and owners). Joining itself now works (INSERT 201). Safe to run more than once. RUN THIS NOW.
-- WHAT WENT WRONG: the rebuild dropped the old "public rooms" SELECT policy together with the recursive ones and recreated only the member / creator ones.
-- THE FIX: add a plain SELECT policy for public rooms (no table subquery, so it cannot recurse).
-- PREFLIGHT (read only): select policyname, cmd, qual from pg_policies where tablename = 'discussion_rooms' and cmd in ('SELECT', 'ALL');   -- no policy mentions room_type = 'public'
-- POST-CHECK (read only): the same query shows cm_discussion_rooms_public_select; the Discussion rooms page lists public rooms again for a non-member.

-- Public rooms must stay visible to everybody who is signed in (the room list and the join button need it). The earlier public-room policy may have been
-- one of those dropped above, so make sure one exists.
DROP POLICY IF EXISTS cm_discussion_rooms_public_select ON public.discussion_rooms;
CREATE POLICY cm_discussion_rooms_public_select ON public.discussion_rooms FOR SELECT
  USING (room_type = 'public' OR is_public = true);
