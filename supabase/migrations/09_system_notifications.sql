-- system_notifications.sql

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    action_url text,
    related_id uuid,
    related_type text,
    priority text DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    is_read boolean DEFAULT false,
    is_actionable boolean DEFAULT false,
    metadata jsonb,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Function to handle notifications automatically (Example)
CREATE OR REPLACE FUNCTION public.create_notification_for_like()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.notifications (user_id, type, title, message, related_id, related_type)
    SELECT author_id, 'like', 'New Like', 'Someone liked your post', NEW.post_id, 'post'
    FROM public.posts
    WHERE id = NEW.post_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);
