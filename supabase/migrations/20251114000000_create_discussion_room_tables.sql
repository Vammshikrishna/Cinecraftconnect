
CREATE TABLE discussion_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    room_type public.room_type DEFAULT 'public'::public.room_type NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE room_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES discussion_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unique_room_member UNIQUE (room_id, user_id)
);

CREATE TABLE room_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    room_id UUID REFERENCES discussion_rooms(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    content TEXT NOT NULL
);

ALTER TABLE discussion_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public rooms are visible to everyone" ON discussion_rooms
FOR SELECT USING (room_type = 'public'::public.room_type);

CREATE POLICY "Private rooms are visible to members" ON discussion_rooms
FOR SELECT USING (id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can create discussion rooms" ON discussion_rooms
FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Room members can see who is in the room" ON room_members
FOR SELECT USING (room_id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can join public rooms" ON room_members
FOR INSERT WITH CHECK (
    (SELECT room_type FROM discussion_rooms WHERE id = room_id) = 'public'::public.room_type
);

CREATE POLICY "Room members can view messages" ON room_messages
FOR SELECT USING (room_id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid()));

CREATE POLICY "Room members can send messages" ON room_messages
FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    room_id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can delete their own messages" ON room_messages
FOR DELETE USING (sender_id = auth.uid());
