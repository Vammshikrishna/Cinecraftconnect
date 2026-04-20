-- Enable pg_trgm for fast text search (fuzzy matching)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Profiles Search Optimization
CREATE INDEX IF NOT EXISTS idx_profiles_search_trgm ON public.profiles USING GIN (
  (full_name || ' ' || username || ' ' || COALESCE(craft, '')) gin_trgm_ops
);

-- 2. Jobs Search Optimization
CREATE INDEX IF NOT EXISTS idx_jobs_search_trgm ON public.jobs USING GIN (
  (title || ' ' || COALESCE(company, '') || ' ' || COALESCE(description, '')) gin_trgm_ops
);

-- 3. Marketplace Search Optimization
CREATE INDEX IF NOT EXISTS idx_marketplace_search_trgm ON public.marketplace_listings USING GIN (
  (title || ' ' || COALESCE(description, '')) gin_trgm_ops
);

-- 4. Optimized RPC for Marketplace (Fetching Listings + Profiles in one shot)
CREATE OR REPLACE FUNCTION public.get_marketplace_listings_optimized(
    search_query TEXT DEFAULT NULL,
    filter_type TEXT DEFAULT NULL,
    filter_category TEXT DEFAULT NULL,
    filter_location TEXT DEFAULT NULL,
    min_price NUMERIC DEFAULT NULL,
    max_price NUMERIC DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    price NUMERIC,
    price_unit TEXT,
    type TEXT,
    category TEXT,
    location TEXT,
    images TEXT[],
    specifications JSONB,
    availability_calendar JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    user_id UUID,
    profile_data JSONB -- Returned as a JSON object
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.title,
        m.description,
        m.price,
        m.price_unit,
        m.type,
        m.category,
        m.location,
        m.images,
        m.specifications,
        m.availability_calendar,
        m.created_at,
        m.updated_at,
        m.user_id,
        jsonb_build_object(
            'username', p.username,
            'full_name', p.full_name,
            'avatar_url', p.avatar_url
        ) AS profile_data
    FROM public.marketplace_listings m
    JOIN public.profiles p ON m.user_id = p.id
    WHERE 
        m.is_active = true
        AND (filter_type IS NULL OR m.type = filter_type)
        AND (filter_category IS NULL OR m.category = filter_category)
        AND (filter_location IS NULL OR m.location ILIKE '%' || filter_location || '%')
        AND (min_price IS NULL OR m.price >= min_price)
        AND (max_price IS NULL OR m.price <= max_price)
        AND (
            search_query IS NULL 
            OR m.title ILIKE '%' || search_query || '%'
            OR m.description ILIKE '%' || search_query || '%'
        )
    ORDER BY m.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
