CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum Types
CREATE TYPE public.room_type AS ENUM (
    'public',
    'private',
    'secret'
);

-- Tables
CREATE TABLE IF NOT EXISTS public.room_categories (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL UNIQUE,
    description text
);

CREATE TABLE IF NOT EXISTS public.discussion_rooms (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    name text NOT NULL,
    description text,
    creator_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id uuid REFERENCES public.room_categories(id) ON DELETE SET NULL,
    tags text[],
    last_activity_at timestamp with time zone DEFAULT now(),
    room_type public.room_type DEFAULT 'public'::room_type
);

CREATE TABLE IF NOT EXISTS public.room_messages (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    room_id uuid NOT NULL REFERENCES public.discussion_rooms(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content text NOT NULL,
    is_read boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.message_reactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL REFERENCES public.room_messages(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    emoji text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT unique_reaction UNIQUE (message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    user1_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user2_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    UNIQUE (user1_id, user2_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content text NOT NULL,
    is_read boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.likes (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id uuid NOT NULL, -- Assuming a posts table exists
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.comments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id uuid NOT NULL, -- Assuming a posts table exists
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    parent_comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.shares (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id uuid NOT NULL, -- Assuming a posts table exists
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL references auth.users(id) on delete cascade PRIMARY KEY,
  updated_at timestamp with time zone,
  username text UNIQUE,
  avatar_url text,
  website text,
  about_me text,
  experience text,
  instagram_url text,
  youtube_url text,

  CONSTRAINT username_length CHECK (char_length(username) >= 3)
);

-- Functions
CREATE OR REPLACE FUNCTION public.update_room_last_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.discussion_rooms
    SET last_activity_at = now()
    WHERE id = NEW.room_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_user_conversations(p_user_id uuid)
RETURNS TABLE(conversation_id uuid, other_user_id uuid, other_user_username text, last_message_content text, last_message_created_at timestamp with time zone) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id AS conversation_id,
        CASE
            WHEN c.user1_id = p_user_id THEN c.user2_id
            ELSE c.user1_id
        END AS other_user_id,
        u.raw_user_meta_data->>'username' AS other_user_username,
        (SELECT content FROM public.messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_content,
        (SELECT created_at FROM public.messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_created_at
    FROM
        public.conversations c
    JOIN
        auth.users u ON u.id = (CASE WHEN c.user1_id = p_user_id THEN c.user2_id ELSE c.user1_id END)
    WHERE
        c.user1_id = p_user_id OR c.user2_id = p_user_id
    ORDER BY
        (SELECT created_at FROM public.messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) DESC;
END; 
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.create_room_and_category(p_name text, p_description text, p_category_name text, p_room_type public.room_type)
RETURNS uuid AS $$
DECLARE
    v_category_id uuid;
    v_room_id uuid;
BEGIN
    -- Upsert category
    INSERT INTO public.room_categories (name) VALUES (p_category_name) ON CONFLICT (name) DO UPDATE SET name = p_category_name RETURNING id INTO v_category_id;
    
    -- Insert room
    INSERT INTO public.discussion_rooms (name, description, creator_id, category_id, room_type) 
    VALUES (p_name, p_description, auth.uid(), v_category_id, p_room_type)
    RETURNING id INTO v_room_id;
    
    RETURN v_room_id;
END;
$$ LANGUAGE plpgsql;

create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

-- Triggers
CREATE TRIGGER on_new_message_update_room_activity
AFTER INSERT ON public.room_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_room_last_activity();

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS Policies
ALTER TABLE public.discussion_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for discussion_rooms
CREATE POLICY "Users can view all public rooms" ON public.discussion_rooms FOR SELECT USING (room_type = 'public');
CREATE POLICY "Users can create rooms" ON public.discussion_rooms FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators can update their own rooms" ON public.discussion_rooms FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Creators can delete their own rooms" ON public.discussion_rooms FOR DELETE USING (auth.uid() = creator_id);

-- Policies for room_messages
CREATE POLICY "Users in a room can view messages" ON public.room_messages FOR SELECT USING (
  (room_id IN (SELECT id FROM public.discussion_rooms WHERE room_type = 'public')) OR
  (EXISTS (SELECT 1 FROM public.discussion_rooms WHERE id = room_id AND creator_id = auth.uid()))
);
CREATE POLICY "Users can send messages in rooms they are part of" ON public.room_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own messages" ON public.room_messages FOR DELETE USING (auth.uid() = user_id);

-- Policies for message_reactions
CREATE POLICY "Users can view all reactions" ON public.message_reactions FOR SELECT USING (true);
CREATE POLICY "Users can insert their own reactions" ON public.message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own reactions" ON public.message_reactions FOR DELETE USING (auth.uid() = user_id);

-- Policies for conversations
CREATE POLICY "Users can view their own conversations" ON public.conversations FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Policies for messages
CREATE POLICY "Users can view messages in their conversations" ON public.messages FOR SELECT USING (conversation_id IN (SELECT id FROM public.conversations));
CREATE POLICY "Users can send messages in their conversations" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Default Category
INSERT INTO public.room_categories (name, description) VALUES ('General', 'General discussions') ON CONFLICT (name) DO NOTHING;
UPDATE public.discussion_rooms SET category_id = (SELECT id FROM public.room_categories WHERE name = 'General') WHERE category_id IS NULL;
