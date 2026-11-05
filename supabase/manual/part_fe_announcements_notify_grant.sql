-- PART FE - fix "403 on rpc/list_announcements" (the Announcements page shows "Error fetching announcements"). Safe to run more than once.
--
-- WHAT WENT WRONG: list_announcements runs as the caller and its first line is PERFORM public.notify_due_announcements().
-- Part ER took EXECUTE on notify_due_announcements away from signed-in people (it looked server-only: no client calls it by name),
-- so every call to list_announcements now fails with "permission denied for function notify_due_announcements" = HTTP 403.
-- THE FIX: give the permission back. This function only sends the "announcement is live now" notifications that are already due,
-- takes no input and returns nothing, so letting the list trigger it is harmless. (Migration 20261005000010 intended exactly this.)
--
-- PREFLIGHT (read only): select has_function_privilege('authenticated', 'public.notify_due_announcements()', 'EXECUTE');   -- false now
-- POST-CHECK  (read only): the same query returns true, then open Announcements: it loads.

GRANT EXECUTE ON FUNCTION public.notify_due_announcements() TO anon, authenticated;
