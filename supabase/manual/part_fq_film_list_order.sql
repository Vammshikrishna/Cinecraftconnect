-- PART FQ (film list order) - lets the owner put the titles of a film list in their own order. Safe to run more than once.
--
-- WHAT THIS ADDS: film_list_items.position, an UPDATE policy so the OWNER of a list can change its items, and the RPC reorder_film_list(list, ids) that writes the order in one call.
-- The website keeps working before this part is run: the list is shown newest first (position empty) and the reorder buttons say the update is not available yet.
--
-- PREFLIGHT (read only): select column_name from information_schema.columns where table_schema = 'public' and table_name = 'film_list_items' and column_name = 'position';   -- 0 rows before
-- POST-CHECK  (read only): the same query returns 1 row; select to_regprocedure('public.reorder_film_list(uuid, uuid[])');  -- not null

SET lock_timeout = '5s';

ALTER TABLE public.film_list_items ADD COLUMN IF NOT EXISTS position integer;
CREATE INDEX IF NOT EXISTS film_list_items_position ON public.film_list_items (list_id, position);

DROP POLICY IF EXISTS film_list_items_update ON public.film_list_items;
CREATE POLICY film_list_items_update ON public.film_list_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.film_lists l WHERE l.id = film_list_items.list_id AND l.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.film_lists l WHERE l.id = film_list_items.list_id AND l.user_id = auth.uid()));

-- SECURITY INVOKER: row level security above decides who may change what, so only the list owner can reorder.
CREATE OR REPLACE FUNCTION public.reorder_film_list(p_list uuid, p_ids uuid[])
RETURNS integer
LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_temp AS $$
  WITH ordered AS (
    SELECT u.id, (u.ord - 1)::integer AS pos FROM unnest(p_ids) WITH ORDINALITY AS u(id, ord)
  ), done AS (
    UPDATE public.film_list_items i SET position = o.pos
      FROM ordered o WHERE i.id = o.id AND i.list_id = p_list
    RETURNING 1
  )
  SELECT count(*)::integer FROM done;
$$;
REVOKE ALL ON FUNCTION public.reorder_film_list(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_film_list(uuid, uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
