-- ─── AUTOMATIC PITCH STATUS NOTIFICATION TRIGGER ───

-- 1. Grant RLS INSERT permission on notifications for authenticated users
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Authenticated users can create notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 2. Trigger function to automatically insert notification when pitch_submissions status changes
CREATE OR REPLACE FUNCTION public.notify_pitch_submission_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pitch_call_title text;
    v_title text;
    v_message text;
    v_priority text := 'normal';
    v_is_actionable boolean := false;
BEGIN
    -- Only trigger if status actually changed
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
        RETURN NEW;
    END IF;

    -- Fetch pitch call title
    SELECT title INTO v_pitch_call_title
    FROM public.pitch_calls
    WHERE id = NEW.pitch_call_id;

    IF NEW.status = 'request_full_deck' THEN
        v_title := '📄 Full Deck Requested!';
        v_message := 'A producer has reviewed your pitch "' || COALESCE(NEW.title, 'your story') || '" and requested your full pitch deck. Time to shine!';
        v_priority := 'high';
        v_is_actionable := true;
    ELSIF NEW.status = 'shortlisted' THEN
        v_title := '⭐ Your Pitch Was Shortlisted!';
        v_message := 'A producer has shortlisted your pitch "' || COALESCE(NEW.title, 'your story') || '". Your story caught their attention!';
        v_priority := 'high';
    ELSIF NEW.status = 'interested' THEN
        v_title := '🎉 A Producer Is Interested!';
        v_message := 'A producer has marked your pitch "' || COALESCE(NEW.title, 'your story') || '" as "Interested". They may reach out soon.';
        v_priority := 'urgent';
    ELSIF NEW.status = 'invite_to_discuss' THEN
        v_title := '💬 You''ve Been Invited to Discuss!';
        v_message := 'A producer wants to talk about your pitch "' || COALESCE(NEW.title, 'your story') || '". Head to your messages!';
        v_priority := 'urgent';
        v_is_actionable := true;
    ELSIF NEW.status = 'passed' THEN
        v_title := 'Pitch Update';
        v_message := 'A producer reviewed your pitch "' || COALESCE(NEW.title, 'your story') || '" and passed this time. Keep pitching!';
        v_priority := 'normal';
    ELSE
        RETURN NEW;
    END IF;

    IF NEW.submitter_id IS NOT NULL THEN
        INSERT INTO public.notifications (
            user_id,
            type,
            title,
            message,
            action_url,
            related_id,
            related_type,
            priority,
            is_read,
            is_actionable,
            metadata
        ) VALUES (
            NEW.submitter_id,
            'pitch_status_' || NEW.status,
            v_title,
            v_message,
            '/pitch/' || NEW.pitch_call_id,
            NEW.id,
            'pitch_submission',
            v_priority,
            false,
            v_is_actionable,
            jsonb_build_object('pitch_call_id', NEW.pitch_call_id, 'status', NEW.status)
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_pitch_submission_status_change ON public.pitch_submissions;

CREATE TRIGGER trigger_pitch_submission_status_change
AFTER UPDATE ON public.pitch_submissions
FOR EACH ROW
EXECUTE FUNCTION public.notify_pitch_submission_status_change();

-- Ensure Supabase Realtime broadcasts notification inserts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

