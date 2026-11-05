-- PART CX - one call that answers "which key version is this chat on, and does the key need changing?" (audit step 10c)
-- Run after part CV. Safe to run more than once.
-- A chat needs a new key when (a) a member was removed or left (the flag set by part CV), OR (b) somebody still holds a
-- key copy but is no longer allowed in the chat: for example a staff access grant that has expired, or a removal that
-- happened some other way. Case (b) is what lets the next member's app clean up after anything that slipped past (a).
CREATE OR REPLACE FUNCTION public.group_key_status(p_type text, p_id uuid)
 RETURNS TABLE(epoch integer, needs_rotation boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE((SELECT s.epoch FROM public.group_key_state s WHERE s.target_type = p_type AND s.target_id = p_id), 1),
         COALESCE((SELECT s.needs_rotation FROM public.group_key_state s WHERE s.target_type = p_type AND s.target_id = p_id), false)
         OR EXISTS (
           SELECT 1 FROM public.group_keys gk
            WHERE gk.target_type = p_type AND gk.target_id = p_id
              AND NOT public.cv_can_see_group(p_type, p_id, gk.user_id)
         )
  WHERE auth.uid() IS NOT NULL AND public.cv_can_see_group(p_type, p_id, auth.uid());
$function$;

REVOKE ALL ON FUNCTION public.group_key_status(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.group_key_status(text, uuid) TO authenticated, service_role;
