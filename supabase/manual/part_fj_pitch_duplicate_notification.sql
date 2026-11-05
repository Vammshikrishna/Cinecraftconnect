-- PART FJ (2) - a new pitch sends the call owner TWO notifications ("New Pitch Submission" and "New pitch received"). Safe to run more than once.
--
-- WHAT WENT WRONG: the original schema has trigger on_pitch_submission (function notify_pitch_submission, link /pitches/<id>, a page that does not exist).
-- Part AV added notify_pitch_submission_received (right link, handles direct pitches). Both fire on every insert into pitch_submissions.
-- THE FIX: remove the old trigger; the newer one stays. Writers' own status notifications are not touched.
--
-- PREFLIGHT (read only): select tgname from pg_trigger where tgrelid = 'public.pitch_submissions'::regclass and not tgisinternal and tgname ilike '%pitch%';   -- two notify triggers
-- POST-CHECK  (read only): the same query shows only the part AV one; submit a pitch: the owner gets one notification.

DROP TRIGGER IF EXISTS on_pitch_submission ON public.pitch_submissions;
