-- realtime_calls.sql

CREATE TABLE IF NOT EXISTS public.calls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid REFERENCES public.discussion_rooms(id) ON DELETE CASCADE,
    created_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    status text DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    type text DEFAULT 'audio' CHECK (type IN ('audio', 'video')),
    created_at timestamp with time zone DEFAULT now(),
    ended_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.call_participants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id uuid REFERENCES public.calls(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at timestamp with time zone DEFAULT now(),
    left_at timestamp with time zone,
    UNIQUE(call_id, user_id)
);

-- RLS
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room members can view calls" ON public.calls FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.room_members WHERE room_id = calls.room_id AND user_id = auth.uid())
);
CREATE POLICY "Participants can view details" ON public.call_participants FOR SELECT USING (user_id = auth.uid());
