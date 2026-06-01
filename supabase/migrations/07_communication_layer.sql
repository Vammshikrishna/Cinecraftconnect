-- communication_layer.sql

-- 1. Conversations & Messages
CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    user1_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user2_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    UNIQUE (user1_id, user2_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text NOT NULL,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone
);

-- 2. Discussion Rooms
CREATE TABLE IF NOT EXISTS public.room_categories (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.discussion_rooms (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    title text NOT NULL,
    description text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    is_public boolean DEFAULT true,
    member_count integer DEFAULT 0,
    room_type text DEFAULT 'public',
    project_id uuid REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    creator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    category_id uuid REFERENCES public.room_categories(id) ON DELETE SET NULL,
    tags text[]
);

CREATE TABLE IF NOT EXISTS public.room_members (
    room_id uuid NOT NULL REFERENCES public.discussion_rooms(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.room_messages (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id uuid NOT NULL REFERENCES public.discussion_rooms(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    priority text DEFAULT 'normal'
);

-- 3. Direct Messages (matches remote)
CREATE TABLE IF NOT EXISTS public.direct_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    channel_id text,
    reply_to_id uuid REFERENCES public.direct_messages(id) ON DELETE SET NULL,
    is_deleted boolean DEFAULT false,
    deleted_for_users uuid[] DEFAULT '{}'::uuid[],
    attachment_url text,
    attachment_type text
);

-- 4. Project Messages (matches remote)
CREATE TABLE IF NOT EXISTS public.project_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    reply_to_id uuid REFERENCES public.project_messages(id) ON DELETE SET NULL,
    is_deleted boolean DEFAULT false,
    deleted_for_users uuid[] DEFAULT '{}'::uuid[]
);

-- 5. Project Space Messages (matches remote)
CREATE TABLE IF NOT EXISTS public.project_space_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_space_id uuid REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text,
    created_at timestamp with time zone DEFAULT now(),
    reply_to_id uuid REFERENCES public.project_space_messages(id) ON DELETE SET NULL,
    is_deleted boolean DEFAULT false,
    deleted_for_users uuid[] DEFAULT '{}'::uuid[],
    attachment_url text,
    attachment_type text
);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_space_messages ENABLE ROW LEVEL SECURITY;

-- Policies for conversations & messages & discussion rooms
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
CREATE POLICY "Users can view own conversations" ON public.conversations FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);

DROP POLICY IF EXISTS "Users can view room messages" ON public.room_messages;
CREATE POLICY "Users can view room messages" ON public.room_messages FOR SELECT USING (EXISTS (SELECT 1 FROM public.room_members WHERE room_id = room_messages.room_id AND user_id = auth.uid()));

-- Policies for direct_messages
DROP POLICY IF EXISTS "Users Clear Own Direct Messages" ON public.direct_messages;
CREATE POLICY "Users Clear Own Direct Messages" ON public.direct_messages FOR DELETE USING ((auth.uid() = sender_id) OR (auth.uid() = receiver_id));

DROP POLICY IF EXISTS "Users Update Own Direct Messages" ON public.direct_messages;
CREATE POLICY "Users Update Own Direct Messages" ON public.direct_messages FOR UPDATE USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can send messages" ON public.direct_messages;
CREATE POLICY "Users can send messages" ON public.direct_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can update their own received messages (mark as read)" ON public.direct_messages;
CREATE POLICY "Users can update their own received messages (mark as read)" ON public.direct_messages FOR UPDATE USING (auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can view their own messages (sent or received)" ON public.direct_messages;
CREATE POLICY "Users can view their own messages (sent or received)" ON public.direct_messages FOR SELECT USING ((auth.uid() = sender_id) OR (auth.uid() = receiver_id));

-- Policies for project_messages
DROP POLICY IF EXISTS "Member Clear Project Messages" ON public.project_messages;
CREATE POLICY "Member Clear Project Messages" ON public.project_messages FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Member Send Project Messages" ON public.project_messages;
CREATE POLICY "Member Send Project Messages" ON public.project_messages FOR INSERT WITH CHECK (is_member_of_project(project_id) AND (( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "Member View Project Messages" ON public.project_messages;
CREATE POLICY "Member View Project Messages" ON public.project_messages FOR SELECT USING ((EXISTS ( SELECT 1 FROM project_space_members WHERE ((project_space_members.project_space_id = project_messages.project_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1 FROM project_spaces WHERE ((project_spaces.id = project_messages.project_id) AND (project_spaces.creator_id = auth.uid())))));

DROP POLICY IF EXISTS "Send Project Messages" ON public.project_messages;
CREATE POLICY "Send Project Messages" ON public.project_messages FOR INSERT WITH CHECK (is_project_member(project_id) OR is_project_creator(project_id));

DROP POLICY IF EXISTS "Users Update Own Project Messages" ON public.project_messages;
CREATE POLICY "Users Update Own Project Messages" ON public.project_messages FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "View Project Messages" ON public.project_messages;
CREATE POLICY "View Project Messages" ON public.project_messages FOR SELECT USING (is_project_member(project_id) OR is_project_creator(project_id));

DROP POLICY IF EXISTS "simple_insert_pm" ON public.project_messages;
CREATE POLICY "simple_insert_pm" ON public.project_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "simple_select_pm" ON public.project_messages;
CREATE POLICY "simple_select_pm" ON public.project_messages FOR SELECT USING (auth.uid() IS NOT NULL);

-- Policies for project_space_messages
DROP POLICY IF EXISTS "Member Clear Project Space Messages" ON public.project_space_messages;
CREATE POLICY "Member Clear Project Space Messages" ON public.project_space_messages FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Member Send Project Space Messages" ON public.project_space_messages;
CREATE POLICY "Member Send Project Space Messages" ON public.project_space_messages FOR INSERT WITH CHECK (is_member_of_project(project_space_id) AND (( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "Member View Project Space Messages" ON public.project_space_messages;
CREATE POLICY "Member View Project Space Messages" ON public.project_space_messages FOR SELECT USING (is_member_of_project(project_space_id));

DROP POLICY IF EXISTS "Users Update Own Project Space Messages" ON public.project_space_messages;
CREATE POLICY "Users Update Own Project Space Messages" ON public.project_space_messages FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "View Messages" ON public.project_space_messages;
CREATE POLICY "View Messages" ON public.project_space_messages FOR SELECT USING (is_project_member(project_space_id) OR is_project_creator(project_space_id));

DROP POLICY IF EXISTS "space_members_send_messages_v2" ON public.project_space_messages;
CREATE POLICY "space_members_send_messages_v2" ON public.project_space_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "space_members_view_messages_v2" ON public.project_space_messages;
CREATE POLICY "space_members_view_messages_v2" ON public.project_space_messages FOR SELECT USING (true);

-- 6. Discussion Room Join Requests
CREATE TABLE IF NOT EXISTS public.room_join_requests (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id uuid REFERENCES public.discussion_rooms(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    message text,
    UNIQUE(room_id, user_id)
);

ALTER TABLE public.room_join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.room_join_requests;
DROP POLICY IF EXISTS "Users view own room requests or if creator" ON public.room_join_requests;
CREATE POLICY "Users view own room requests or if creator" ON public.room_join_requests FOR SELECT USING (
    (auth.uid() = user_id) OR
    EXISTS (SELECT 1 FROM public.discussion_rooms WHERE id = room_id AND creator_id = auth.uid())
);

DROP POLICY IF EXISTS "Users insert own room requests" ON public.room_join_requests;
CREATE POLICY "Users insert own room requests" ON public.room_join_requests FOR INSERT WITH CHECK (
    (auth.uid() = user_id)
);

DROP POLICY IF EXISTS "Creator manage room requests" ON public.room_join_requests;
CREATE POLICY "Creator manage room requests" ON public.room_join_requests FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.discussion_rooms WHERE id = room_id AND creator_id = auth.uid())
);

DROP POLICY IF EXISTS "Users delete own room requests or creator" ON public.room_join_requests;
CREATE POLICY "Users delete own room requests or creator" ON public.room_join_requests FOR DELETE USING (
    (auth.uid() = user_id) OR
    EXISTS (SELECT 1 FROM public.discussion_rooms WHERE id = room_id AND creator_id = auth.uid())
);

