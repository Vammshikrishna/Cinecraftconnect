CREATE TABLE IF NOT EXISTS "public"."user_follows" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "follower_id" uuid NOT NULL,
    "following_id" uuid NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY ("id"),
    UNIQUE ("follower_id", "following_id")
);

-- Foreign keys
ALTER TABLE "public"."user_follows" ADD CONSTRAINT "fk_follower_user" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
ALTER TABLE "public"."user_follows" ADD CONSTRAINT "fk_following_user" FOREIGN KEY ("following_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

-- RLS
ALTER TABLE "public"."user_follows" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view follows" ON "public"."user_follows" FOR SELECT USING (true);
CREATE POLICY "Users can insert follows" ON "public"."user_follows" FOR INSERT WITH CHECK (follower_id = auth.uid());
CREATE POLICY "Users can delete follows" ON "public"."user_follows" FOR DELETE USING (follower_id = auth.uid());

-- Grants
GRANT ALL ON TABLE "public"."user_follows" TO "anon";
GRANT ALL ON TABLE "public"."user_follows" TO "authenticated";
GRANT ALL ON TABLE "public"."user_follows" TO "service_role";

-- Triggers for notification
CREATE OR REPLACE FUNCTION "public"."handle_new_follower_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    actor_name text;
BEGIN
    SELECT COALESCE(full_name, username, 'Someone') INTO actor_name 
    FROM public.profiles 
    WHERE id = NEW.follower_id;

    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id)
    VALUES (
        NEW.following_id, 
        NEW.follower_id,
        'new_follower', 
        'New Follower', 
        actor_name || ' is now following you', 
        '/network', 
        NEW.follower_id
    );
    
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER "on_user_follow_notification" AFTER INSERT ON "public"."user_follows" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_follower_notification"();
