-- Create user_availability table
CREATE TABLE public.user_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'free', -- 'free', 'tentative', 'booked'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT user_availability_status_check CHECK (status IN ('free', 'tentative', 'booked'))
);

-- Enable RLS
ALTER TABLE public.user_availability ENABLE ROW LEVEL SECURITY;

-- Add updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at trigger
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.user_availability
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Policies
CREATE POLICY "Users can manage their own availability"
    ON public.user_availability
    FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view user availability"
    ON public.user_availability
    FOR SELECT
    USING (true);

-- Add is_locked to schedule_items
ALTER TABLE public.schedule_items ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;

-- Trigger to notify assigned crew member when schedule is locked
CREATE OR REPLACE FUNCTION notify_schedule_locked()
RETURNS TRIGGER AS $$
BEGIN
    -- Only notify if it just got locked and someone is assigned
    IF NEW.is_locked = true AND OLD.is_locked = false AND NEW.assigned_to IS NOT NULL THEN
        INSERT INTO public.notifications (
            user_id,
            type,
            title,
            content,
            reference_id,
            reference_type
        ) VALUES (
            NEW.assigned_to,
            'schedule_locked',
            'Schedule Locked',
            'A schedule phase you are assigned to ("' || NEW.title || '") has been locked.',
            NEW.id,
            'schedule_item'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_schedule_locked
    AFTER UPDATE ON public.schedule_items
    FOR EACH ROW
    EXECUTE FUNCTION notify_schedule_locked();
