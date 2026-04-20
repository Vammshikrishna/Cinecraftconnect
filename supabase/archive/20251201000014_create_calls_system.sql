-- Create calls table for managing video/voice calls
CREATE TABLE IF NOT EXISTS public.calls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_type text NOT NULL CHECK (room_type IN ('project', 'discussion')),
    room_id uuid NOT NULL, -- project_id or discussion_room_id
    daily_room_name text UNIQUE NOT NULL,
    daily_room_url text NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    started_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    started_at timestamptz DEFAULT now() NOT NULL,
    ended_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Create call_participants table for tracking who's in the call
CREATE TABLE IF NOT EXISTS public.call_participants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'joined' CHECK (status IN ('requesting', 'joined', 'left')),
    joined_at timestamptz DEFAULT now() NOT NULL,
    left_at timestamptz,
    UNIQUE(call_id, user_id)
);

-- Create call_reactions table for emoji reactions during calls
CREATE TABLE IF NOT EXISTS public.call_reactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    emoji text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_calls_room ON public.calls(room_type, room_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON public.calls(status);
CREATE INDEX IF NOT EXISTS idx_call_participants_call_id ON public.call_participants(call_id);
CREATE INDEX IF NOT EXISTS idx_call_participants_user_id ON public.call_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_call_reactions_call_id ON public.call_reactions(call_id);

-- Enable RLS
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for calls table
CREATE POLICY "Users can view calls in their projects/rooms"
ON public.calls FOR SELECT
USING (
    (room_type = 'project' AND EXISTS (
        SELECT 1 FROM public.project_space_members
        WHERE project_space_id = room_id AND user_id = auth.uid()
    )) OR
    (room_type = 'project' AND EXISTS (
        SELECT 1 FROM public.project_spaces
        WHERE id = room_id AND creator_id = auth.uid()
    )) OR
    (room_type = 'discussion' AND EXISTS (
        SELECT 1 FROM public.room_members
        WHERE room_id = calls.room_id AND user_id = auth.uid()
    ))
);

CREATE POLICY "Project/room members can create calls"
ON public.calls FOR INSERT
WITH CHECK (
    (room_type = 'project' AND (
        EXISTS (
            SELECT 1 FROM public.project_space_members
            WHERE project_space_id = room_id AND user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.project_spaces
            WHERE id = room_id AND creator_id = auth.uid()
        )
    )) OR
    (room_type = 'discussion' AND EXISTS (
        SELECT 1 FROM public.room_members
        WHERE room_id = calls.room_id AND user_id = auth.uid()
    ))
);

CREATE POLICY "Call creator can update call"
ON public.calls FOR UPDATE
USING (started_by = auth.uid());

-- RLS Policies for call_participants table
CREATE POLICY "Users can view participants in their calls"
ON public.call_participants FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.calls
        WHERE id = call_id AND (
            (room_type = 'project' AND (
                EXISTS (
                    SELECT 1 FROM public.project_space_members
                    WHERE project_space_id = room_id AND user_id = auth.uid()
                ) OR EXISTS (
                    SELECT 1 FROM public.project_spaces
                    WHERE id = room_id AND creator_id = auth.uid()
                )
            )) OR
            (room_type = 'discussion' AND EXISTS (
                SELECT 1 FROM public.room_members
                WHERE room_id = calls.room_id AND user_id = auth.uid()
            ))
        )
    )
);

CREATE POLICY "Users can join calls"
ON public.call_participants FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own participation"
ON public.call_participants FOR UPDATE
USING (user_id = auth.uid());

-- RLS Policies for call_reactions table
CREATE POLICY "Users can view reactions in their calls"
ON public.call_reactions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.calls
        WHERE id = call_id AND (
            (room_type = 'project' AND (
                EXISTS (
                    SELECT 1 FROM public.project_space_members
                    WHERE project_space_id = room_id AND user_id = auth.uid()
                ) OR EXISTS (
                    SELECT 1 FROM public.project_spaces
                    WHERE id = room_id AND creator_id = auth.uid()
                )
            )) OR
            (room_type = 'discussion' AND EXISTS (
                SELECT 1 FROM public.room_members
                WHERE room_id = calls.room_id AND user_id = auth.uid()
            ))
        )
    )
);

CREATE POLICY "Users can create reactions in calls they're in"
ON public.call_reactions FOR INSERT
WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.call_participants
        WHERE call_id = call_reactions.call_id 
        AND user_id = auth.uid() 
        AND status = 'joined'
    )
);
