-- Phase 4: Advanced Analytics & AI Features

-- User engagement analytics table
CREATE TABLE public.user_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'page_view', 'post_like', 'post_create', 'comment_create', 'room_join', etc.
  event_data JSONB DEFAULT '{}',
  page_url TEXT,
  duration_seconds INTEGER,
  device_info JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Smart notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL, -- 'like', 'comment', 'follow', 'mention', 'recommendation', 'system'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  related_id UUID, -- ID of related post, comment, user, etc.
  related_type TEXT, -- 'post', 'comment', 'user', 'project', etc.
  priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  is_read BOOLEAN DEFAULT false,
  is_actionable BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- AI content recommendations table
CREATE TABLE public.ai_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  recommendation_type TEXT NOT NULL, -- 'post', 'user', 'project', 'room', 'collaboration'
  recommended_id UUID NOT NULL,
  recommended_type TEXT NOT NULL, -- 'post', 'user', 'project', 'room', 'collaboration'
  score DECIMAL(3,2) DEFAULT 0.5, -- 0.00 to 1.00 confidence score
  reason TEXT, -- Explanation for the recommendation
  ai_model TEXT DEFAULT 'content-based', -- AI model used for recommendation
  interaction_data JSONB DEFAULT '{}', -- User interaction history used for recommendation
  is_shown BOOLEAN DEFAULT false,
  is_clicked BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Content moderation table
CREATE TABLE public.content_moderation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID NOT NULL,
  content_type TEXT NOT NULL, -- 'post', 'comment', 'message', 'profile'
  content_text TEXT,
  moderation_status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'flagged', 'removed'
  ai_confidence DECIMAL(3,2), -- AI confidence score for moderation decision
  ai_flags JSONB DEFAULT '[]', -- Array of AI-detected issues
  human_reviewed BOOLEAN DEFAULT false,
  human_reviewer_id UUID,
  moderation_reason TEXT,
  moderated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User engagement scores (daily aggregation)
CREATE TABLE public.user_engagement_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  posts_created INTEGER DEFAULT 0,
  comments_made INTEGER DEFAULT 0,
  likes_given INTEGER DEFAULT 0,
  likes_received INTEGER DEFAULT 0,
  profile_views INTEGER DEFAULT 0,
  session_duration_minutes INTEGER DEFAULT 0,
  engagement_score DECIMAL(5,2) DEFAULT 0, -- Calculated engagement score
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable Row Level Security
ALTER TABLE public.user_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_moderation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_engagement_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_analytics
CREATE POLICY "Users can insert their own analytics"
ON public.user_analytics FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own analytics"
ON public.user_analytics FOR SELECT
USING (auth.uid() = user_id);

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
ON public.notifications FOR INSERT
WITH CHECK (true); -- Allow system to create notifications

-- RLS Policies for ai_recommendations
CREATE POLICY "Users can view their own recommendations"
ON public.ai_recommendations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own recommendations"
ON public.ai_recommendations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can create recommendations"
ON public.ai_recommendations FOR INSERT
WITH CHECK (true); -- Allow system to create recommendations

-- RLS Policies for content_moderation
CREATE POLICY "Content creators can view moderation of their content"
ON public.content_moderation FOR SELECT
USING (
  content_id IN (
    SELECT id FROM posts WHERE author_id = auth.uid()
    UNION
    SELECT id FROM post_comments WHERE user_id = auth.uid()
    UNION
    SELECT id FROM room_messages WHERE user_id = auth.uid()
  )
);

-- RLS Policies for user_engagement_scores
CREATE POLICY "Users can view their own engagement scores"
ON public.user_engagement_scores FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can manage engagement scores"
ON public.user_engagement_scores FOR ALL
USING (true)
WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_user_analytics_user_id ON public.user_analytics(user_id);
CREATE INDEX idx_user_analytics_event_type ON public.user_analytics(event_type);
CREATE INDEX idx_user_analytics_created_at ON public.user_analytics(created_at);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at);
CREATE INDEX idx_notifications_priority ON public.notifications(priority);

CREATE INDEX idx_ai_recommendations_user_id ON public.ai_recommendations(user_id);
CREATE INDEX idx_ai_recommendations_type ON public.ai_recommendations(recommendation_type);
CREATE INDEX idx_ai_recommendations_score ON public.ai_recommendations(score);
CREATE INDEX idx_ai_recommendations_created_at ON public.ai_recommendations(created_at);

CREATE INDEX idx_content_moderation_content_id ON public.content_moderation(content_id);
CREATE INDEX idx_content_moderation_status ON public.content_moderation(moderation_status);
CREATE INDEX idx_content_moderation_created_at ON public.content_moderation(created_at);

CREATE INDEX idx_user_engagement_scores_user_id ON public.user_engagement_scores(user_id);
CREATE INDEX idx_user_engagement_scores_date ON public.user_engagement_scores(date);
CREATE INDEX idx_user_engagement_scores_score ON public.user_engagement_scores(engagement_score);

-- Function to calculate daily engagement scores
CREATE OR REPLACE FUNCTION public.calculate_daily_engagement_score(target_date DATE DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
AS $$
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
$$;

-- Function to create notifications
CREATE OR REPLACE FUNCTION public.create_notification(
  target_user_id UUID,
  notification_type TEXT,
  notification_title TEXT,
  notification_message TEXT,
  action_url TEXT DEFAULT NULL,
  related_id UUID DEFAULT NULL,
  related_type TEXT DEFAULT NULL,
  priority TEXT DEFAULT 'normal'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
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
$$;

-- Triggers for automatic notification creation
CREATE OR REPLACE FUNCTION public.trigger_post_like_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.trigger_comment_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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
$$;

-- Create triggers
CREATE TRIGGER trigger_post_like_notification
  AFTER INSERT ON public.post_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_post_like_notification();

CREATE TRIGGER trigger_comment_notification
  AFTER INSERT ON public.post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_comment_notification();

-- Update triggers for updated_at timestamps
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_recommendations_updated_at
  BEFORE UPDATE ON public.ai_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_content_moderation_updated_at
  BEFORE UPDATE ON public.content_moderation
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_engagement_scores_updated_at
  BEFORE UPDATE ON public.user_engagement_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();