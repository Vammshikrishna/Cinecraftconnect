-- PART FW (admin 2) - internal STAFF NOTES on an account. A moderator or admin can leave a short private note on a person ("asked twice for a refund, calm", "known
-- bot ring, see case 123") so the next person on the team sees it in the account record instead of starting from nothing. Visible to staff only, never to the user.
-- Safe to run more than once. The website works without this part (the Notes section says it needs the database update and hides the form).
--
-- DESIGN: a table nobody can read or write directly (no policies, no grants) and two functions for staff: add_user_note (writes the note and an audit-log line)
-- and list_user_notes (newest first, with the author's username). Staff = public.staff_rank(auth.uid()) >= 1 (moderator and above), the same test the account record uses.
--
-- PREFLIGHT (read only): select to_regclass('public.staff_user_notes');            -- null before, 'staff_user_notes' after
-- POST-CHECK  (read only): in Admin > User Management > "..." > View record & strikes (after part FW part 1 too): add a note; it shows with your username; a normal account
--   cannot call it: select public.list_user_notes('<any uuid>'); as a non-staff user returns "Staff only".

CREATE TABLE IF NOT EXISTS public.staff_user_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL,
  note       text NOT NULL CHECK (length(btrim(note)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staff_user_notes_user ON public.staff_user_notes (user_id, created_at DESC);
ALTER TABLE public.staff_user_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.staff_user_notes FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.add_user_note(p_user uuid, p_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id uuid; v_role text;
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 1 THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501'; END IF;
  IF p_user IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user) THEN RAISE EXCEPTION 'That account does not exist'; END IF;
  IF length(btrim(COALESCE(p_note, ''))) < 1 THEN RAISE EXCEPTION 'Write a note first'; END IF;
  IF length(btrim(p_note)) > 1000 THEN RAISE EXCEPTION 'A note can be 1000 characters at most'; END IF;
  INSERT INTO public.staff_user_notes (user_id, author_id, note) VALUES (p_user, auth.uid(), btrim(p_note)) RETURNING id INTO v_id;
  SELECT role::text INTO v_role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), COALESCE(v_role, 'staff'), 'add_user_note', 'user', p_user::text, jsonb_build_object('note_id', v_id));
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_user_notes(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 1 THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id', n.id, 'note', n.note, 'created_at', n.created_at, 'author', pr.username) ORDER BY n.created_at DESC)
                     FROM (SELECT * FROM public.staff_user_notes WHERE user_id = p_user ORDER BY created_at DESC LIMIT 50) n
                     LEFT JOIN public.profiles pr ON pr.id = n.author_id), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.add_user_note(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_user_notes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_user_note(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_user_notes(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
