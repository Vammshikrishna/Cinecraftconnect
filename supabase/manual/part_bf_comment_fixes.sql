-- PART BF: comment fixes.
--  1. A comment can be at most 2000 characters (the apps already stop at the same limit).
--  2. The author of a post can delete any comment on their own post, and staff can delete any comment.
--     Until now only the comment's own author could (the web "admin" button relied on another policy).
-- Run after part BD. Safe to run twice.
BEGIN;

CREATE OR REPLACE FUNCTION public.guard_post_comment_length()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.market_is_system() THEN
    RETURN NEW;
  END IF;
  IF length(btrim(coalesce(NEW.content, ''))) > 2000 THEN
    RAISE EXCEPTION 'Comment is too long (2000 characters at most)' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_post_comment_length ON public.post_comments;
CREATE TRIGGER trg_guard_post_comment_length BEFORE INSERT OR UPDATE OF content ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.guard_post_comment_length();

DROP POLICY IF EXISTS post_author_delete_comments ON public.post_comments;
CREATE POLICY post_author_delete_comments ON public.post_comments FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_comments.post_id AND p.author_id = auth.uid()));

DROP POLICY IF EXISTS staff_delete_comments ON public.post_comments;
CREATE POLICY staff_delete_comments ON public.post_comments FOR DELETE
  USING (public.is_current_user_internal());

COMMIT;
