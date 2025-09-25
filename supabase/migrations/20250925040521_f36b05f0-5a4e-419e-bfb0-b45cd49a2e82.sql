-- Fix database functions security: Add proper search_path to all functions
-- This prevents potential SQL injection and ensures functions operate in correct schema context

-- Update update_post_stats function
CREATE OR REPLACE FUNCTION public.update_post_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'post_likes' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.posts SET like_count = like_count - 1 WHERE id = OLD.post_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'post_comments' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.posts SET comment_count = comment_count - 1 WHERE id = OLD.post_id;
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;

-- Update update_room_member_count function
CREATE OR REPLACE FUNCTION public.update_room_member_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.discussion_rooms SET member_count = member_count + 1 WHERE id = NEW.room_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.discussion_rooms SET member_count = member_count - 1 WHERE id = OLD.room_id;
    RETURN OLD;
  END IF;
END;
$function$;

-- Update calculate_daily_engagement_score function
CREATE OR REPLACE FUNCTION public.calculate_daily_engagement_score(target_date date DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.user_engagement_scores (
    user_id,
    date,
    posts_created,
    comments_made,
    likes_given,
    likes_received,
    engagement_score
  )
  SELECT 
    u.user_id,
    target_date,
    COALESCE(posts.count, 0) as posts_created,
    COALESCE(comments.count, 0) as comments_made,
    COALESCE(likes_given.count, 0) as likes_given,
    COALESCE(likes_received.count, 0) as likes_received,
    (
      COALESCE(posts.count, 0) * 10 +
      COALESCE(comments.count, 0) * 5 +
      COALESCE(likes_given.count, 0) * 2 +
      COALESCE(likes_received.count, 0) * 3
    )::DECIMAL(5,2) as engagement_score
  FROM (
    SELECT DISTINCT author_id as user_id FROM posts
    UNION
    SELECT DISTINCT user_id FROM post_comments
    UNION
    SELECT DISTINCT user_id FROM post_likes
  ) u
  LEFT JOIN (
    SELECT author_id as user_id, COUNT(*) as count
    FROM posts
    WHERE DATE(created_at) = target_date
    GROUP BY author_id
  ) posts ON u.user_id = posts.user_id
  LEFT JOIN (
    SELECT user_id, COUNT(*) as count
    FROM post_comments
    WHERE DATE(created_at) = target_date
    GROUP BY user_id
  ) comments ON u.user_id = comments.user_id
  LEFT JOIN (
    SELECT user_id, COUNT(*) as count
    FROM post_likes
    WHERE DATE(created_at) = target_date
    GROUP BY user_id
  ) likes_given ON u.user_id = likes_given.user_id
  LEFT JOIN (
    SELECT p.author_id as user_id, COUNT(*) as count
    FROM post_likes pl
    JOIN posts p ON pl.post_id = p.id
    WHERE DATE(pl.created_at) = target_date
    GROUP BY p.author_id
  ) likes_received ON u.user_id = likes_received.user_id
  ON CONFLICT (user_id, date) 
  DO UPDATE SET
    posts_created = EXCLUDED.posts_created,
    comments_made = EXCLUDED.comments_made,
    likes_given = EXCLUDED.likes_given,
    likes_received = EXCLUDED.likes_received,
    engagement_score = EXCLUDED.engagement_score,
    updated_at = now();
END;
$function$;

-- Update create_notification function
CREATE OR REPLACE FUNCTION public.create_notification(target_user_id uuid, notification_type text, notification_title text, notification_message text, action_url text DEFAULT NULL::text, related_id uuid DEFAULT NULL::uuid, related_type text DEFAULT NULL::text, priority text DEFAULT 'normal'::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    action_url,
    related_id,
    related_type,
    priority
  ) VALUES (
    target_user_id,
    notification_type,
    notification_title,
    notification_message,
    action_url,
    related_id,
    related_type,
    priority
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$function$;

-- Update trigger_post_like_notification function
CREATE OR REPLACE FUNCTION public.trigger_post_like_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  post_author_id UUID;
  liker_name TEXT;
BEGIN
  -- Get post author
  SELECT author_id INTO post_author_id
  FROM posts
  WHERE id = NEW.post_id;
  
  -- Don't notify if user likes their own post
  IF post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get liker's name (simplified - in real app would get from profiles)
  liker_name := 'Someone';
  
  -- Create notification
  PERFORM public.create_notification(
    post_author_id,
    'like',
    'New Like',
    liker_name || ' liked your post',
    '/feed',
    NEW.post_id,
    'post',
    'normal'
  );
  
  RETURN NEW;
END;
$function$;

-- Update trigger_comment_notification function
CREATE OR REPLACE FUNCTION public.trigger_comment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  post_author_id UUID;
  commenter_name TEXT;
BEGIN
  -- Get post author
  SELECT author_id INTO post_author_id
  FROM posts
  WHERE id = NEW.post_id;
  
  -- Don't notify if user comments on their own post
  IF post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get commenter's name (simplified)
  commenter_name := 'Someone';
  
  -- Create notification
  PERFORM public.create_notification(
    post_author_id,
    'comment',
    'New Comment',
    commenter_name || ' commented on your post',
    '/feed',
    NEW.post_id,
    'post',
    'normal'
  );
  
  RETURN NEW;
END;
$function$;