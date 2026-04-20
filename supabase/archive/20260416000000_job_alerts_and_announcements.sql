-- ============================================================================
-- JOB ALERTS & GLOBAL ANNOUNCEMENTS TRIGGERS
-- ============================================================================

-- Function to handle job matching and announcements
CREATE OR REPLACE FUNCTION public.handle_mass_notifications()
RETURNS TRIGGER AS $$
DECLARE
    _target_user_id UUID;
    _actor_id UUID;
    _title TEXT;
    _message TEXT;
    _type TEXT;
    _action_url TEXT;
BEGIN
    _actor_id := auth.uid();

    -- 1. HANDLE NEW JOBS (Job Alerts)
    IF TG_TABLE_NAME = 'jobs' AND TG_OP = 'INSERT' THEN
        -- Notify users whose craft or bio matches the job title/description
        FOR _target_user_id IN 
            SELECT id FROM public.profiles 
            WHERE (craft IS NOT NULL AND (NEW.title ILIKE '%' || craft || '%' OR NEW.description ILIKE '%' || craft || '%'))
            OR (bio IS NOT NULL AND (bio ILIKE '%' || NEW.title || '%'))
        LOOP
            -- Don't notify the person who posted the job
            IF _target_user_id != NEW.posted_by THEN
                INSERT INTO public.notifications (
                    user_id, actor_id, type, title, message, related_id, related_type, priority, action_url
                ) VALUES (
                    _target_user_id, 
                    NEW.posted_by, 
                    'job_alert', 
                    'New Job Match!', 
                    'A new job "' || NEW.title || '" matches your profile.', 
                    NEW.id, 
                    'job', 
                    'high', 
                    '/jobs/' || NEW.id
                );
            END IF;
        END LOOP;

    -- 2. HANDLE ANNOUNCEMENTS (Global)
    ELSIF TG_TABLE_NAME = 'announcements' AND TG_OP = 'INSERT' THEN
        -- Notify EVERYONE
        FOR _target_user_id IN SELECT id FROM public.profiles LOOP
            INSERT INTO public.notifications (
                user_id, actor_id, type, title, message, related_id, related_type, priority, action_url
            ) VALUES (
                _target_user_id, 
                NEW.author_id, 
                'system_announcement', 
                'Platform Announcement', 
                NEW.title, 
                NEW.id, 
                'announcement', 
                'high', 
                '/announcements'
            );
        END LOOP;

    -- 3. HANDLE NETWORK SUGGESTIONS (On Profile Update)
    ELSIF TG_TABLE_NAME = 'profiles' AND TG_OP = 'UPDATE' THEN
        -- Only trigger if onboarding was just completed
        IF OLD.onboarding_completed = false AND NEW.onboarding_completed = true THEN
            FOR _target_user_id IN 
                SELECT id FROM public.profiles 
                WHERE id != NEW.id 
                AND (craft = NEW.craft OR location = NEW.location)
                LIMIT 5 -- Suggest up to 5 relevant people
            LOOP
                SELECT COALESCE(full_name, username) INTO _title FROM public.profiles WHERE id = _target_user_id;
                
                INSERT INTO public.notifications (
                    user_id, actor_id, type, title, message, related_id, related_type, priority, action_url
                ) VALUES (
                    NEW.id, 
                    _target_user_id, 
                    'network_suggestion', 
                    'Suggested Connection', 
                    'You might know ' || COALESCE(_title, 'this user') || ' who is also a ' || COALESCE(NEW.craft, 'creator') || '.', 
                    _target_user_id, 
                    'profile', 
                    'medium', 
                    '/profile/' || _target_user_id
                );
            END LOOP;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS notify_on_new_job ON public.jobs;
CREATE TRIGGER notify_on_new_job 
    AFTER INSERT ON public.jobs 
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_mass_notifications();

DROP TRIGGER IF EXISTS notify_on_new_announcement ON public.announcements;
CREATE TRIGGER notify_on_new_announcement 
    AFTER INSERT ON public.announcements 
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_mass_notifications();

DROP TRIGGER IF EXISTS notify_on_onboarding_complete ON public.profiles;
CREATE TRIGGER notify_on_onboarding_complete 
    AFTER UPDATE ON public.profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_mass_notifications();
