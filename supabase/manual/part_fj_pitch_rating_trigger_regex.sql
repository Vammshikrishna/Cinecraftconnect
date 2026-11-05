-- PART FJ - fix "invalid regular expression: invalid repetition count(s)" when anyone rates a title (RPC submit_film_feedback returns 400). Safe to run more than once.
--
-- WHAT WENT WRONG: part CQ added the trigger cq_clean_rating_meta on user_film_ratings. Its poster-address pattern uses {1,480}, but PostgreSQL
-- only accepts repetition counts up to 255, so EVERY rating insert or update by a normal (non-staff) account failed. Ratings were broken for everybody.
-- THE FIX: the same cleaning, with the length checked separately (path up to 200 characters, web address up to 500) and no count above 255 in the patterns.
--
-- PREFLIGHT (read only): select 'x'::text ~ '^[a-z]{1,480}$';     -- ERROR: invalid regular expression: invalid repetition count(s)
-- POST-CHECK  (read only): rate any title on /ratings as a Fan or Creator: it saves and /ratings/mine lists it.

CREATE OR REPLACE FUNCTION public.cq_clean_rating_meta()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR COALESCE(public.is_current_user_internal(), false) THEN
    RETURN NEW;
  END IF;
  IF NEW.title IS NOT NULL THEN
    NEW.title := left(btrim(NEW.title), 200);
    IF NEW.title = '' THEN NEW.title := NULL; END IF;
  END IF;
  IF NEW.poster_path IS NOT NULL AND NOT (
       (length(NEW.poster_path) <= 201 AND NEW.poster_path ~ '^/[A-Za-z0-9_.-]+$')
    OR (length(NEW.poster_path) <= 500 AND NEW.poster_path ~ '^https://[^[:space:]<>"'']+$')
  ) THEN
    NEW.poster_path := NULL;
  END IF;
  IF NEW.media_type IS NOT NULL AND NEW.media_type !~ '^[a-z_]{1,20}$' THEN
    NEW.media_type := NULL;
  END IF;
  RETURN NEW;
END;
$function$;
