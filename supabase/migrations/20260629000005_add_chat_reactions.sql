-- Create reactions table for project space messages
CREATE TABLE IF NOT EXISTS "public"."project_space_message_reactions" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "message_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "emoji" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY ("id"),
    CONSTRAINT "project_space_message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."project_space_messages"("id") ON DELETE CASCADE,
    CONSTRAINT "project_space_message_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    UNIQUE ("message_id", "user_id", "emoji")
);

-- Enable RLS for project_space_message_reactions
ALTER TABLE "public"."project_space_message_reactions" ENABLE ROW LEVEL SECURITY;

-- Policies for project_space_message_reactions
CREATE POLICY "Project members can view reactions" ON "public"."project_space_message_reactions" 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM project_space_messages psm
        WHERE psm.id = project_space_message_reactions.message_id
        AND public.is_member_of_project(psm.project_space_id)
    )
);

CREATE POLICY "Project members can add reactions" ON "public"."project_space_message_reactions" 
FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
        SELECT 1 FROM project_space_messages psm
        WHERE psm.id = project_space_message_reactions.message_id
        AND public.is_member_of_project(psm.project_space_id)
    )
);

CREATE POLICY "Users can remove their own reactions" ON "public"."project_space_message_reactions" 
FOR DELETE USING (auth.uid() = user_id);

-- Enable Realtime for project_space_message_reactions
ALTER PUBLICATION supabase_realtime ADD TABLE "public"."project_space_message_reactions";


-- Create reactions table for room messages
CREATE TABLE IF NOT EXISTS "public"."room_message_reactions" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "message_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "emoji" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY ("id"),
    CONSTRAINT "room_message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."room_messages"("id") ON DELETE CASCADE,
    CONSTRAINT "room_message_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    UNIQUE ("message_id", "user_id", "emoji")
);

-- Enable RLS for room_message_reactions
ALTER TABLE "public"."room_message_reactions" ENABLE ROW LEVEL SECURITY;

-- Policies for room_message_reactions
CREATE POLICY "Room members can view reactions" ON "public"."room_message_reactions" 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM room_messages rm
        JOIN discussion_rooms dr ON dr.id = rm.room_id
        LEFT JOIN room_members mbr ON mbr.room_id = dr.id AND mbr.user_id = auth.uid()
        WHERE rm.id = room_message_reactions.message_id
        AND (dr.room_type = 'public' OR dr.is_public = true OR mbr.user_id IS NOT NULL)
    )
);

CREATE POLICY "Room members can add reactions" ON "public"."room_message_reactions" 
FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
        SELECT 1 FROM room_messages rm
        JOIN discussion_rooms dr ON dr.id = rm.room_id
        LEFT JOIN room_members mbr ON mbr.room_id = dr.id AND mbr.user_id = auth.uid()
        WHERE rm.id = room_message_reactions.message_id
        AND (dr.room_type = 'public' OR dr.is_public = true OR mbr.user_id IS NOT NULL)
    )
);

CREATE POLICY "Users can remove their own room reactions" ON "public"."room_message_reactions" 
FOR DELETE USING (auth.uid() = user_id);

-- Enable Realtime for room_message_reactions
ALTER PUBLICATION supabase_realtime ADD TABLE "public"."room_message_reactions";
