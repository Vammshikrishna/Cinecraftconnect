-- PART H: safe to run now (adds the export_my_data() function).
BEGIN;
-- Self-service data export (GDPR/DPDP access & portability). Returns everything the caller owns as JSON.
-- Each table is read through a tolerant helper so a missing table/column never breaks the whole export.
-- Secrets are intentionally excluded: key backups, group keys, push tokens, session token hashes.

CREATE OR REPLACE FUNCTION public._export_rows(p_table text, p_col text, p_uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM public.%I t WHERE t.%I = $1',
    p_table, p_col
  ) INTO v_result USING p_uid;
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;  -- table or column not present in this deployment
END;
$$;
REVOKE ALL ON FUNCTION public._export_rows(text, text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.export_my_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_out jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  v_out := jsonb_build_object(
    'exported_at', now(),
    'user_id', v_uid,
    'email', (SELECT email FROM auth.users WHERE id = v_uid),
    'notice', 'Direct and project-space message contents are end-to-end encrypted and appear as ciphertext. '
              || 'Cryptographic keys, key backups, push tokens and session secrets are excluded for your security.',
    'profile',            public._export_rows('profiles', 'id', v_uid),
    'profile_private',    public._export_rows('profile_private', 'user_id', v_uid),
    'profile_extras',     public._export_rows('profile_extras', 'user_id', v_uid),
    'settings',           public._export_rows('user_settings', 'user_id', v_uid),
    'posts',              public._export_rows('posts', 'author_id', v_uid),
    'post_comments',      public._export_rows('post_comments', 'user_id', v_uid),
    'post_likes',         public._export_rows('post_likes', 'user_id', v_uid),
    'post_bookmarks',     public._export_rows('post_bookmarks', 'user_id', v_uid),
    'portfolio_items',    public._export_rows('portfolio_items', 'user_id', v_uid),
    'projects_created',   public._export_rows('projects', 'creator_id', v_uid),
    'project_applications', public._export_rows('project_applications', 'user_id', v_uid),
    'project_space_memberships', public._export_rows('project_space_members', 'user_id', v_uid),
    'project_space_messages', public._export_rows('project_space_messages', 'user_id', v_uid),
    'job_applications',   public._export_rows('job_applications', 'applicant_id', v_uid),
    'jobs_posted',        public._export_rows('jobs', 'posted_by', v_uid),
    'direct_messages_sent', public._export_rows('direct_messages', 'sender_id', v_uid),
    'direct_messages_received', public._export_rows('direct_messages', 'receiver_id', v_uid),
    'room_memberships',   public._export_rows('room_members', 'user_id', v_uid),
    'room_messages',      public._export_rows('room_messages', 'user_id', v_uid),
    'connections_as_follower',  public._export_rows('user_connections', 'follower_id', v_uid),
    'connections_as_following', public._export_rows('user_connections', 'following_id', v_uid),
    'follows',            public._export_rows('user_follows', 'follower_id', v_uid),
    'followers',          public._export_rows('user_follows', 'following_id', v_uid),
    'blocked_users',      public._export_rows('blocked_users', 'user_id', v_uid),
    'notifications',      public._export_rows('notifications', 'user_id', v_uid),
    'marketplace_listings', public._export_rows('marketplace_listings', 'user_id', v_uid),
    'marketplace_bookings_as_renter', public._export_rows('marketplace_bookings', 'renter_id', v_uid),
    'marketplace_bookings_as_owner',  public._export_rows('marketplace_bookings', 'owner_id', v_uid),
    'marketplace_reviews', public._export_rows('marketplace_reviews', 'reviewer_id', v_uid),
    'marketplace_wishlists', public._export_rows('marketplace_wishlists', 'user_id', v_uid),
    'vendors',            public._export_rows('vendors', 'owner_id', v_uid),
    'company_pages',      public._export_rows('company_pages', 'owner_id', v_uid),
    'announcements',      public._export_rows('announcements', 'author_id', v_uid),
    'pitch_calls',        public._export_rows('pitch_calls', 'creator_id', v_uid),
    'pitch_submissions',  public._export_rows('pitch_submissions', 'submitter_id', v_uid),
    'story_listings',     public._export_rows('story_listings', 'creator_id', v_uid),
    'film_ratings',       public._export_rows('user_film_ratings', 'user_id', v_uid),
    'verification_requests', public._export_rows('verification_requests', 'user_id', v_uid),
    'support_tickets',    public._export_rows('support_tickets', 'user_id', v_uid),
    'content_reports_filed', public._export_rows('content_reports', 'reported_by', v_uid),
    'availability',       public._export_rows('user_availability', 'user_id', v_uid)
  );

  RETURN jsonb_strip_nulls(v_out);
END;
$$;

REVOKE ALL ON FUNCTION public.export_my_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_my_data() TO authenticated;
COMMIT;
