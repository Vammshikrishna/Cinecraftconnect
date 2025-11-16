-- Wrap the entire seed script in a transaction to ensure atomicity
BEGIN;

-- Create some sample users, providing metadata for the trigger to create profiles
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
('00000000-0000-0000-0000-000000000000', 'a1b2c3d4-e5f6-7890-1234-567890abcdef', 'authenticated', 'authenticated', 'user1@example.com', 'encrypted_password_1', '2024-01-01 12:00:00+00', NULL, NULL, '{ "provider": "email", "providers": ["email"] }', '{"username": "dev_user1"}', '2024-01-01 12:00:00+00', '2024-01-01 12:00:00+00'),
('00000000-0000-0000-0000-000000000000', 'b2c3d4e5-f6a7-8901-2345-67890abcdef0', 'authenticated', 'authenticated', 'user2@example.com', 'encrypted_password_2', '2024-01-01 12:00:00+00', NULL, NULL, '{ "provider": "email", "providers": ["email"] }', '{"username": "design_user2"}', '2024-01-01 12:00:00+00', '2024-01-01 12:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- The handle_new_user trigger will automatically create the profiles.

-- Create some room categories, doing nothing if they already exist
INSERT INTO public.room_categories (name, description) VALUES
('Design', 'Everything related to UI/UX and visual design')
ON CONFLICT (name) DO NOTHING;

do $$
DECLARE
    general_cat_id uuid;
    design_cat_id uuid;
    general_room_id uuid;
    design_room_id uuid;
    message1_id uuid;
BEGIN
    -- Select category IDs. The 'General' category is created in the init script, so we can rely on it being present.
    SELECT id INTO general_cat_id FROM public.room_categories WHERE name = 'General';
    SELECT id INTO design_cat_id FROM public.room_categories WHERE name = 'Design';

    -- Create discussion rooms if they don't exist and get their IDs.
    INSERT INTO public.discussion_rooms (name, description, room_type, category_id, creator_id)
    SELECT 'General Chat', 'A place for everyone to chat about anything.', 'public', general_cat_id, 'a1b2c3d4-e5f6-7890-1234-567890abcdef'
    WHERE NOT EXISTS (SELECT 1 FROM public.discussion_rooms WHERE name = 'General Chat');

    INSERT INTO public.discussion_rooms (name, description, room_type, category_id, creator_id)
    SELECT 'Design Hangout', 'A private room for designers.', 'private', design_cat_id, 'b2c3d4e5-f6a7-8901-2345-67890abcdef0'
    WHERE NOT EXISTS (SELECT 1 FROM public.discussion_rooms WHERE name = 'Design Hangout');

    SELECT id INTO general_room_id FROM public.discussion_rooms WHERE name = 'General Chat';
    SELECT id INTO design_room_id FROM public.discussion_rooms WHERE name = 'Design Hangout';

    -- Add messages to the rooms, if they don't exist.
    INSERT INTO public.room_messages (room_id, user_id, content)
    SELECT general_room_id, 'a1b2c3d4-e5f6-7890-1234-567890abcdef', 'Hello everyone, welcome to the general chat!'
    WHERE general_room_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.room_messages WHERE content = 'Hello everyone, welcome to the general chat!' AND room_id = general_room_id);

    INSERT INTO public.room_messages (room_id, user_id, content)
    SELECT general_room_id, 'b2c3d4e5-f6a7-8901-2345-67890abcdef0', 'Hey there! Glad to be here.'
    WHERE general_room_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.room_messages WHERE content = 'Hey there! Glad to be here.' AND room_id = general_room_id);

    INSERT INTO public.room_messages (room_id, user_id, content)
    SELECT design_room_id, 'b2c3d4e5-f6a7-8901-2345-67890abcdef0', 'Welcome to the design hangout. Let''s talk about some cool UI stuff.'
    WHERE design_room_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.room_messages WHERE content = 'Welcome to the design hangout. Let''s talk about some cool UI stuff.' AND room_id = design_room_id);

    -- Get the message ID for the reaction.
    SELECT id INTO message1_id FROM public.room_messages WHERE content = 'Hello everyone, welcome to the general chat!' AND room_id = general_room_id;

    -- Add a reaction to a message, if it doesn't exist
    IF message1_id IS NOT NULL THEN
        INSERT INTO public.message_reactions (message_id, user_id, emoji)
        VALUES (message1_id, 'b2c3d4e5-f6a7-8901-2345-67890abcdef0', '👋')
        ON CONFLICT (message_id, user_id, emoji) DO NOTHING;
    END IF;

EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE NOTICE 'Seed script finished, but some data may not have been inserted due to existing entries.';
END$$;

COMMIT;
