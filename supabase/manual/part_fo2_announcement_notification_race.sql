-- PART FO2 (announcements, 3) - a follower STILL gets two "X announced" notifications even after parts FO (1) and (2), and right after posting there is none.
-- WHAT IS GOING ON: the notification is sent when someone loads the announcement list (notify_due_announcements); two list loads at the same moment (the page
-- loads twice, plus the live update) both run send_announcement_notifications() in separate transactions, each sees "nobody notified yet" (the other one has not
-- committed), and both insert. The "skip people who already have it" guard cannot see an uncommitted row.
-- THE FIX: take an advisory lock per announcement at the start of the function, so the second request waits, then sees the first one's committed rows and sends nothing.
-- Safe to run more than once.
--
-- POST-CHECK (read only): select related_id, user_id, count(*) from public.notifications where type = 'announcement' group by 1, 2 having count(*) > 1;   -- 0 rows for NEW announcements
--   then post an announcement, open Announcements in two tabs at once, reload: each follower has ONE notification.

CREATE OR REPLACE FUNCTION public.send_announcement_notifications(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  a announcements%ROWTYPE;
  v_name text;
BEGIN
  -- one sender at a time per announcement: two requests that load the list at the same moment both found "not notified yet" and both sent it
  PERFORM pg_advisory_xact_lock(hashtextextended('announcement-notify:' || p_id::text, 0));
  SELECT * INTO a FROM announcements WHERE id = p_id;
  IF a.id IS NULL THEN RETURN; END IF;

  IF a.publisher_page_id IS NOT NULL THEN
    SELECT name INTO v_name FROM company_pages WHERE id = a.publisher_page_id;
  ELSE
    SELECT COALESCE(full_name, username) INTO v_name FROM profiles WHERE id = a.author_id;
  END IF;

  INSERT INTO notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
  SELECT r.user_id, a.author_id, 'announcement', COALESCE(v_name, 'New') || ' announced', left(a.title, 120), '/announcements', a.id, false
  FROM (
    SELECT DISTINCT u AS user_id FROM (
      -- the team always hears about it
      SELECT user_id AS u FROM company_page_members WHERE a.publisher_page_id IS NOT NULL AND page_id = a.publisher_page_id
      UNION ALL
      SELECT user_id FROM company_page_admins WHERE a.publisher_page_id IS NOT NULL AND page_id = a.publisher_page_id
      UNION ALL
      -- followers of the page (not for team-only ones)
      SELECT user_id FROM company_page_followers WHERE a.publisher_page_id IS NOT NULL AND a.audience <> 'team' AND page_id = a.publisher_page_id
      UNION ALL
      -- followers of the person
      SELECT follower_id FROM user_follows WHERE a.publisher_page_id IS NULL AND following_id = a.author_id
    ) x
    WHERE u IS NOT NULL AND u <> a.author_id
      -- never notify the same person twice about the same announcement (the flag "notified" was not always saved, so the list loader sent it again)
      AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.type = 'announcement' AND n.related_id = a.id AND n.user_id = u)
    LIMIT 500
  ) r;
END;
$$;
REVOKE ALL ON FUNCTION public.send_announcement_notifications(uuid) FROM PUBLIC, anon, authenticated;

DELETE FROM public.notifications n
USING public.notifications m
WHERE n.type = 'announcement' AND m.type = 'announcement'
  AND n.related_id = m.related_id AND n.user_id = m.user_id
  AND (n.created_at, n.id::text) > (m.created_at, m.id::text);
