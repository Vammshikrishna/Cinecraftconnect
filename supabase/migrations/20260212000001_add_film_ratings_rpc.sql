-- Create a function to get aggregated film ratings efficiently
CREATE OR REPLACE FUNCTION public.get_aggregated_film_ratings(tmdb_ids integer[])
RETURNS TABLE (
    tmdb_id integer,
    average_rating numeric,
    review_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ufr.tmdb_id,
        AVG(ufr.rating)::numeric as average_rating,
        COUNT(*) as review_count
    FROM 
        public.user_film_ratings ufr
    WHERE 
        ufr.tmdb_id = ANY(tmdb_ids)
    GROUP BY 
        ufr.tmdb_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to authenticated users and anon users (since ratings are public)
GRANT EXECUTE ON FUNCTION public.get_aggregated_film_ratings(integer[]) TO authenticated, anon;
