-- Re-define update_post_stats trigger function to run with SECURITY DEFINER privileges.
-- This ensures that when standard users like/unlike or comment on posts,
-- the trigger can successfully update the posts table even if the user is not the post author under RLS.
CREATE OR REPLACE FUNCTION public.update_post_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF (TG_TABLE_NAME = 'post_likes') THEN
            UPDATE public.posts SET like_count = coalesce(like_count, 0) + 1 WHERE id = NEW.post_id;
        ELSIF (TG_TABLE_NAME = 'post_comments') THEN
            UPDATE public.posts SET comment_count = coalesce(comment_count, 0) + 1 WHERE id = NEW.post_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF (TG_TABLE_NAME = 'post_likes') THEN
            UPDATE public.posts SET like_count = GREATEST(0, coalesce(like_count, 0) - 1) WHERE id = OLD.post_id;
        ELSIF (TG_TABLE_NAME = 'post_comments') THEN
            UPDATE public.posts SET comment_count = GREATEST(0, coalesce(comment_count, 0) - 1) WHERE id = OLD.post_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$function$;

-- Add an asynchronous, non-blocking push trigger on public.notifications using pg_net
DROP TRIGGER IF EXISTS notifications_push_delivery ON public.notifications;
CREATE TRIGGER notifications_push_delivery
    AFTER INSERT ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_push_delivery();
