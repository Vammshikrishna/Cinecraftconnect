-- PART EI - fix the vendor page error "400 on rpc/get_vendor_with_rating". Safe to run more than once. Run any time.
--
-- WHAT WENT WRONG: get_vendor_with_rating returned "v.*" (every column of the vendors table) and promised a fixed list of
-- 17 vendor columns + average_rating + review_count. Part BX added a new column to vendors (verification_expires_at), so
-- "v.*" now gives 18 vendor columns and Postgres refuses the query ("structure of query does not match function result
-- type"). The website then showed "Error fetching vendor details" and the app fell back to a slower direct read.
-- THE FIX: name the columns one by one, so adding columns to vendors later can never break this function again.
-- The result shape (columns and types) is exactly the same as before, so the website and the app need no change.
--
-- PREFLIGHT (read only):  select count(*) from public.vendors;     -- the function reads this table
-- POST-CHECK (read only): select * from public.get_vendor_with_rating((select id from public.vendors limit 1));  -- 1 row, no error

BEGIN;

CREATE OR REPLACE FUNCTION public.get_vendor_with_rating(vendor_uuid uuid)
RETURNS TABLE(id uuid, owner_id uuid, business_name text, description text, category text[], services_offered text[],
              location text, address text, phone text, email text, website text, logo_url text, images text[],
              is_verified boolean, verification_date timestamptz, created_at timestamptz, updated_at timestamptz,
              average_rating numeric, review_count bigint)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $function$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT
    v.id, v.owner_id, v.business_name, v.description, v.category, v.services_offered,
    v.location, v.address, v.phone, v.email, v.website, v.logo_url, v.images,
    v.is_verified, v.verification_date, v.created_at, v.updated_at,
    COALESCE(AVG(mr.rating), 0)::numeric AS average_rating,
    COUNT(mr.id) AS review_count
  FROM public.vendors v
  LEFT JOIN public.marketplace_reviews mr ON mr.vendor_id = v.id
  WHERE v.id = vendor_uuid
  GROUP BY v.id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_vendor_with_rating(uuid) TO anon, authenticated;

COMMIT;
