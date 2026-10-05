-- NOTE: the original file was truncated (corrupted). The project-space part below is the intact original;
-- the room-message part is reconstructed from the application code (room_message_reactions).

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

ALTER TABLE "public"."project_space_message_reactions" ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE "public"."room_message_reactions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room members can view reactions" ON "public"."room_message_reactions"
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM room_messages rm
        WHERE rm.id = room_message_reactions.message_id
        AND public.is_room_member(rm.room_id)
    )
);

CREATE POLICY "Room members can add reactions" ON "public"."room_message_reactions"
FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
        SELECT 1 FROM room_messages rm
        WHERE rm.id = room_message_reactions.message_id
        AND public.is_room_member(rm.room_id)
    )
);

CREATE POLICY "Users can remove their own room reactions" ON "public"."room_message_reactions"
FOR DELETE USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE "public"."room_message_reactions";
