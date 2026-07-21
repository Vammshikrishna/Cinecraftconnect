-- Fix get_algorithmic_feed ambiguous column reference

CREATE OR REPLACE FUNCTION get_algorithmic_feed(
  current_user_id UUID,
  limit_val INT,
  created_at_cursor TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  author_id UUID,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  media_url TEXT,
  media_type TEXT,
  media_items JSONB,
  page_id UUID,
  like_count INT,
  comment_count INT,
  share_count INT,
  tags TEXT[],
  has_ai_generated BOOLEAN,
  is_pinned BOOLEAN,
  score NUMERIC,
  profiles JSON,
  company_pages JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.author_id,
    p.content,
    p.created_at,
    p.updated_at,
    p.media_url,
    p.media_type,
    p.media_items::jsonb,
    p.page_id,
    COALESCE(p.like_count, 0)::int as like_count,
    COALESCE(p.comment_count, 0)::int as comment_count,
    COALESCE(p.share_count, 0)::int as share_count,
    p.tags,
    p.has_ai_generated,
    p.is_pinned,
    -- Score calculations
    (
      10.0 + -- base score
      CASE 
        -- Boost connections
        WHEN current_user_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM user_follows f 
          WHERE f.follower_id = current_user_id AND f.following_id = p.author_id
        ) THEN 100.0
        WHEN current_user_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM user_connections c 
          WHERE c.status = 'accepted' AND (
            (c.follower_id = current_user_id AND c.following_id = p.author_id) OR
            (c.following_id = current_user_id AND c.follower_id = p.author_id)
          )
        ) THEN 100.0
        ELSE 0.0
      END +
      (COALESCE(p.like_count, 0) * 3.0) +
      (COALESCE(p.comment_count, 0) * 6.0)
    ) / POWER(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0 + 2.0, 1.2)::numeric as score,
    -- User profile relation
    (
      SELECT row_to_json(pr_sub) 
      FROM (
        SELECT pr.id, pr.username, pr.full_name, pr.avatar_url, pr.craft, pr.is_verified 
        FROM profiles pr
        WHERE pr.id = p.author_id
      ) pr_sub
    ) as profiles,
    -- Company page relation
    (
      SELECT row_to_json(cp_sub)
      FROM (
        SELECT cp.id, cp.name, cp.logo_url, cp.slug, cp.is_verified
        FROM company_pages cp
        WHERE cp.id = p.page_id
      ) cp_sub
    ) as company_pages
  FROM posts p
  WHERE 
    (created_at_cursor IS NULL OR p.created_at < created_at_cursor)
  ORDER BY score DESC, p.created_at DESC
  LIMIT limit_val;
END;
$$;
