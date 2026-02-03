-- Function to fetch all home feed data in a single RPC call to minimize roundtrips
CREATE OR REPLACE FUNCTION public.get_home_feed_data(user_id_param UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'posts', (
            SELECT jsonb_agg(t) FROM (
                SELECT p.*, 
                    jsonb_build_object(
                        'id', pr.id,
                        'full_name', pr.full_name,
                        'username', pr.username,
                        'avatar_url', pr.avatar_url,
                        'craft', pr.craft
                    ) as profiles
                FROM public.posts p
                LEFT JOIN public.profiles pr ON p.author_id = pr.id
                ORDER BY p.created_at DESC
                LIMIT 20
            ) t
        ),
        'announcements', (
            SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
                SELECT * FROM public.announcements
                ORDER BY posted_at DESC
                LIMIT 5
            ) t
        ),
        'projects', (
            SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
                SELECT p.*, 
                    jsonb_build_object(
                        'full_name', pr.full_name,
                        'avatar_url', pr.avatar_url
                    ) as creator
                FROM public.projects p
                LEFT JOIN public.profiles pr ON p.creator_id = pr.id
                ORDER BY p.created_at DESC
                LIMIT 5
            ) t
        ),
        'discussions', (
            SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
                SELECT * FROM public.discussion_rooms
                ORDER BY created_at DESC
                LIMIT 5
            ) t
        ),
        'marketplace', (
            SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
                SELECT * FROM public.marketplace_listings
                ORDER BY created_at DESC
                LIMIT 5
            ) t
        ),
        'vendors', (
            SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
                SELECT * FROM public.vendors
                ORDER BY created_at DESC
                LIMIT 5
            ) t
        ),
        'connections', (
            SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
                SELECT id, full_name, username, avatar_url, craft, bio 
                FROM public.profiles
                WHERE id != user_id_param
                ORDER BY updated_at DESC
                LIMIT 6
            ) t
        ),
        'likedPostIds', (
            SELECT COALESCE(jsonb_agg(post_id), '[]'::jsonb) 
            FROM public.post_likes 
            WHERE user_id = user_id_param
        )
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
