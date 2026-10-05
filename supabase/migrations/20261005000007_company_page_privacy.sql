-- Company pages: privacy. Run AFTER part V. Safe to re-run.
--   * The follower list was readable by anyone. Now a person sees only their own follow, and page managers see
--     the list through page_followers().
--   * Page contact email / phone were readable by anyone, including signed-out visitors and scrapers. They move to a
--     separate table that only signed-in people can read. The apps keep writing them to company_pages as before: a
--     trigger moves the values across and clears the public columns.

-- ── followers ─────────────────────────────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view followers" ON public.company_page_followers;
DROP POLICY IF EXISTS "Own follows and managers see followers" ON public.company_page_followers;
CREATE POLICY "Own follows and managers see followers" ON public.company_page_followers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_page_manager(page_id, auth.uid()));

-- ── contacts ──────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_page_contacts (
  page_id uuid PRIMARY KEY REFERENCES public.company_pages(id) ON DELETE CASCADE,
  email text,
  phone text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_page_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Signed-in users read page contacts" ON public.company_page_contacts;
CREATE POLICY "Signed-in users read page contacts" ON public.company_page_contacts FOR SELECT TO authenticated USING (true);
-- no write policies: the trigger below is the only writer

-- move what is already stored
INSERT INTO public.company_page_contacts (page_id, email, phone)
SELECT id, NULLIF(trim(email), ''), NULLIF(trim(phone), '')
FROM public.company_pages
WHERE NULLIF(trim(COALESCE(email, '')), '') IS NOT NULL OR NULLIF(trim(COALESCE(phone, '')), '') IS NOT NULL
ON CONFLICT (page_id) DO UPDATE SET email = EXCLUDED.email, phone = EXCLUDED.phone, updated_at = now();

DO $$
BEGIN
  PERFORM set_config('app.market_system', '1', true);
  UPDATE public.company_pages SET email = NULL, phone = NULL WHERE email IS NOT NULL OR phone IS NOT NULL;
  PERFORM set_config('app.market_system', '', true);
END;
$$;

-- values written to company_pages.email / .phone land in the private table and the public columns stay empty.
-- An empty string means "clear it"; leaving the column out of an update changes nothing.
CREATE OR REPLACE FUNCTION public.company_pages_move_contacts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO company_page_contacts (page_id, email, phone)
  VALUES (NEW.id, NULLIF(trim(COALESCE(NEW.email, '')), ''), NULLIF(trim(COALESCE(NEW.phone, '')), ''))
  ON CONFLICT (page_id) DO UPDATE SET
    email = CASE WHEN NEW.email IS NOT NULL THEN NULLIF(trim(NEW.email), '') ELSE company_page_contacts.email END,
    phone = CASE WHEN NEW.phone IS NOT NULL THEN NULLIF(trim(NEW.phone), '') ELSE company_page_contacts.phone END,
    updated_at = now();

  PERFORM set_config('app.market_system', '1', true);
  UPDATE company_pages SET email = NULL, phone = NULL WHERE id = NEW.id;
  PERFORM set_config('app.market_system', '', true);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_company_pages_move_contacts ON public.company_pages;
CREATE TRIGGER trg_company_pages_move_contacts AFTER INSERT OR UPDATE OF email, phone ON public.company_pages
  FOR EACH ROW WHEN (NEW.email IS NOT NULL OR NEW.phone IS NOT NULL) EXECUTE FUNCTION public.company_pages_move_contacts();
