-- PART DD - withdrawing and re-submitting a pitch no longer deletes the call owner's notes (audit step 15, finding 72).
-- Before: a writer who withdrew a pitch and pitched the same call again made the database DELETE the old (withdrawn) submission,
-- and that cascaded to the call owner's private notes and rating, the NDA signatures and the access log for it.
-- Now: the old withdrawn submission stays (those records stay with it) and only ONE live (not withdrawn) pitch per writer per
-- call is allowed. The app already ignores withdrawn rows when it looks for "my pitch to this call".
-- Safe to run more than once.

-- 1. replace the "one submission per writer per call" rule with "one live submission per writer per call"
DO $$
DECLARE
  r record;
BEGIN
  -- unique constraints made of exactly (pitch_call_id, submitter_id)
  FOR r IN
    SELECT con.conname
      FROM pg_constraint con
     WHERE con.conrelid = 'public.pitch_submissions'::regclass
       AND con.contype = 'u'
       AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
              FROM pg_attribute a WHERE a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey))
           = ARRAY['pitch_call_id', 'submitter_id']
  LOOP
    EXECUTE format('ALTER TABLE public.pitch_submissions DROP CONSTRAINT %I', r.conname);
  END LOOP;
  -- plain unique indexes on the same two columns
  FOR r IN
    SELECT i.indexrelid::regclass::text AS idx
      FROM pg_index i
     WHERE i.indrelid = 'public.pitch_submissions'::regclass
       AND i.indisunique AND NOT i.indisprimary AND i.indpred IS NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = i.indexrelid)
       AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
              FROM pg_attribute a WHERE a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey::int2[]))
           = ARRAY['pitch_call_id', 'submitter_id']
  LOOP
    EXECUTE format('DROP INDEX %s', r.idx);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS pitch_submissions_one_live_per_writer
  ON public.pitch_submissions (pitch_call_id, submitter_id)
  WHERE status <> 'withdrawn';

-- 2. the trigger that deleted the old withdrawn row no longer deletes anything
CREATE OR REPLACE FUNCTION public.pitch_clear_withdrawn()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN NEW;  -- a withdrawn submission is kept (with the call owner's notes, NDA signatures and access log)
END;
$function$;
