-- PART GE (3) - "busy" check before a direct call. Safe to run more than once.
--
-- WHAT THIS ADDS: function is_partner_busy(partner uuid). It answers true when that person is in a live call right now AND the caller already
-- has a chat with them. Nothing else is revealed (no call id, no room, no names). The website asks it before it starts a direct call and tells
-- the caller "X is on another call" instead of ringing and leaving the caller alone in a call screen. The website works without it (it then
-- behaves as before).
--
-- PREFLIGHT (read only): select to_regprocedure('public.is_partner_busy(uuid)');   -- null before
-- POST-CHECK  (read only): same query -> is_partner_busy(uuid); while a test account is in a call, run: select public.is_partner_busy('<their id>');   -- true from a person who has a chat with them

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.is_partner_busy(p_partner uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND p_partner IS NOT NULL
    AND p_partner <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.direct_messages d
      WHERE (d.sender_id = auth.uid() AND d.receiver_id = p_partner)
         OR (d.sender_id = p_partner AND d.receiver_id = auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.call_participants cp
      JOIN public.calls c ON c.id = cp.call_id
      WHERE cp.user_id = p_partner
        AND cp.status = 'joined'
        AND cp.left_at IS NULL
        AND c.status = 'active'
        AND c.ended_at IS NULL
        AND c.started_at > now() - interval '12 hours'
    );
$$;

REVOKE ALL ON FUNCTION public.is_partner_busy(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_partner_busy(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
