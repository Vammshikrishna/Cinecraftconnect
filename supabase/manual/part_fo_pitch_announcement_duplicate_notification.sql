-- PART FO (announcements) - every announcement notified each follower TWICE ("X announced · title" appears two times in Notifications).
-- WHAT WENT WRONG: the after-insert trigger sends the notifications and then sets announcements.notified = true, but that flag is not always saved
-- (the update is guarded), so notify_due_announcements(), which runs whenever the Announcements list is loaded, sent the same notifications again.
-- THE FIX: send_announcement_notifications() now skips anyone who already has a notification for that announcement, and the existing duplicates are removed
-- (the oldest copy is kept). Safe to run more than once.
--
-- PREFLIGHT (read only): select related_id, user_id, count(*) from public.notifications where type = 'announcement' group by 1, 2 having count(*) > 1 limit 20;   -- rows now
-- POST-CHECK  (read only): the same query returns 0 rows; post an announcement as a user with followers: each follower gets ONE notification.

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
