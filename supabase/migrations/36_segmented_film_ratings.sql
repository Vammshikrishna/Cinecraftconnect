-- Create an updated RPC that calculates segmented ratings based on account type
CREATE OR REPLACE FUNCTION public.get_segmented_film_ratings(tmdb_ids integer[])
RETURNS TABLE (
    tmdb_id integer,
    overall_average numeric,
    overall_count bigint,
    pro_average numeric,
    pro_count bigint,
    fan_average numeric,
    fan_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ufr.tmdb_id,
        ROUND(AVG(ufr.rating)::numeric, 1) as overall_average,
        COUNT(*) as overall_count,
        ROUND(AVG(CASE WHEN p.account_type IN ('creator', 'studio') OR p.account_type IS NULL THEN ufr.rating ELSE NULL END)::numeric, 1) as pro_average,
        COUNT(CASE WHEN p.account_type IN ('creator', 'studio') OR p.account_type IS NULL THEN 1 ELSE NULL END) as pro_count,
        ROUND(AVG(CASE WHEN p.account_type = 'fan' THEN ufr.rating ELSE NULL END)::numeric, 1) as fan_average,
        COUNT(CASE WHEN p.account_type = 'fan' THEN 1 ELSE NULL END) as fan_count
    FROM 
        public.user_film_ratings ufr
    JOIN
        public.profiles p ON ufr.user_id = p.id
    WHERE 
        ufr.tmdb_id = ANY(tmdb_ids)
    GROUP BY 
        ufr.tmdb_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_segmented_film_ratings(integer[]) TO authenticated, anon;
