-- Migration: Unified Home Feed RPC Function
-- Purpose: Returns announcements, projects, and discussions in a single database roundtrip with zero client JOIN overhead.

CREATE OR REPLACE FUNCTION public.get_unified_feed(
  p_limit INT DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'announcements', COALESCE((
      SELECT jsonb_agg(a) FROM (
        SELECT 
          ann.id, ann.title, ann.content, ann.posted_at, ann.author_id, ann.publisher_page_id,
          CASE WHEN pr.id IS NOT NULL THEN jsonb_build_object('full_name', pr.full_name, 'username', pr.username, 'avatar_url', pr.avatar_url) ELSE NULL END AS profiles,
          CASE WHEN cp.id IS NOT NULL THEN jsonb_build_object('id', cp.id, 'name', cp.name, 'logo_url', cp.logo_url, 'slug', cp.slug) ELSE NULL END AS company_pages
        FROM public.announcements ann
        LEFT JOIN public.profiles pr ON pr.id = ann.author_id
        LEFT JOIN public.company_pages cp ON cp.id = ann.publisher_page_id
        ORDER BY ann.posted_at DESC
        LIMIT p_limit
      ) a
    ), '[]'::jsonb),

    'projects', COALESCE((
      SELECT jsonb_agg(p) FROM (
        SELECT 
          proj.id, proj.title, proj.description, proj.category, proj.status, proj.banner_url, proj.created_at, proj.creator_id,
          CASE WHEN pr.id IS NOT NULL THEN jsonb_build_object('full_name', pr.full_name, 'avatar_url', pr.avatar_url) ELSE NULL END AS creator
        FROM public.projects proj
        LEFT JOIN public.profiles pr ON pr.id = proj.creator_id
        ORDER BY proj.created_at DESC
        LIMIT p_limit
      ) p
    ), '[]'::jsonb),

    'discussions', COALESCE((
      SELECT jsonb_agg(d) FROM (
        SELECT 
          disc.id, disc.title, disc.topic, disc.created_at
        FROM public.discussion_rooms disc
        ORDER BY disc.created_at DESC
        LIMIT p_limit
      ) d
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;
