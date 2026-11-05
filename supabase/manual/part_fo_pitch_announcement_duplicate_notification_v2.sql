-- PART FO (announcements, 2) - a follower STILL gets two "X announced" notifications for one announcement after part FO (1).
-- Part FO (1) added a "skip people who already have it" guard to send_announcement_notifications(). The duplicates still arrive, so a SECOND, unguarded
-- sender exists in the live project: another trigger on public.announcements (older than the repo's migrations) that writes the same notification.
-- THE FIX: drop every trigger on public.announcements whose function writes 'announcement' notifications, EXCEPT the one the app is built on
-- (announcements_after_insert). Then remove the duplicates that already exist (oldest copy kept). Safe to run more than once.
--
-- PREFLIGHT (read only) - paste the rows back if the duplicates continue after this part:
--   select t.tgname, p.proname, left(pg_get_functiondef(p.oid), 0) as _ , (pg_get_functiondef(p.oid) ilike '%announced%') as writes_announced
--   from pg_trigger t join pg_proc p on p.oid = t.tgfoid
--   where t.tgrelid = 'public.announcements'::regclass and not t.tgisinternal order by 1;
-- POST-CHECK (read only): select related_id, user_id, count(*) from public.notifications where type = 'announcement' group by 1, 2 having count(*) > 1;   -- 0 rows
--   then post an announcement: each follower gets ONE notification (also after opening the Announcements page).

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.announcements'::regclass
      AND NOT t.tgisinternal
      AND p.proname NOT IN ('announcements_after_insert', 'announcements_guard', 'announcements_log_edit', 'update_updated_at_column')
      AND (pg_get_functiondef(p.oid) ILIKE '%announced%' OR pg_get_functiondef(p.oid) ILIKE '%INSERT INTO notifications%' OR pg_get_functiondef(p.oid) ILIKE '%INSERT INTO public.notifications%')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.announcements', r.tgname);
  END LOOP;
END $$;

-- the "notified" flag must really be saved, otherwise the list loader re-sends: show if any announcement is still marked not notified although it is live
-- (read only)  select count(*) from public.announcements where not notified and posted_at <= now();     -- should be 0

DELETE FROM public.notifications n
USING public.notifications m
WHERE n.type = 'announcement' AND m.type = 'announcement'
  AND n.related_id = m.related_id AND n.user_id = m.user_id
  AND (n.created_at, n.id::text) > (m.created_at, m.id::text);
