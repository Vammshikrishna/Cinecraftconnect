-- Wrap the entire seed script in a transaction to ensure atomicity
BEGIN;

-- Create some sample users
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_token, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token_encrypted, confirmation_sent_at) VALUES
('00000000-0000-0000-0000-000000000000', 'a1b2c3d4-e5f6-7890-1234-567890abcdef', 'authenticated', 'authenticated', 'user1@example.com', 'encrypted_password_1', '2024-01-01 12:00:00+00', '', NULL, NULL, '{ "provider": "email", "providers": ["email"] }', '{}', '2024-01-01 12:00:00+00', '2024-01-01 12:00:00+00', '', '', '', '', NULL),
('00000000-0000-0000-0000-000000000000', 'b2c3d4e5-f6a7-8901-2345-67890abcdef0', 'authenticated', 'authenticated', 'user2@example.com', 'encrypted_password_2', '2024-01-01 12:00:00+00', '', NULL, NULL, '{ "provider": "email", "providers": ["email"] }', '{}', '2024-01-01 12:00:00+00', '2024-01-01 12:00:00+00', '', '', '', '', NULL);

-- Create corresponding user profiles
INSERT INTO public.profiles (id, username, full_name, craft) VALUES
('a1b2c3d4-e5f6-7890-1234-567890abcdef', 'dev_user1', 'Developer User 1', 'Software Development'),
('b2c3d4e5-f6a7-8901-2345-67890abcdef0', 'design_user2', 'Designer User 2', 'UI/UX Design');

-- Create some room categories
INSERT INTO public.room_categories (name, description, is_private) VALUES
('General', 'General discussion topics', false),
('Design', 'Everything related to UI/UX and visual design', false);

do $$
DECLARE
    general_cat_id uuid;
    design_cat_id uuid;
    general_room_id uuid;
    design_room_id uuid;
    message1_id uuid;
BEGIN
    -- Use STRICT to ensure categories exist, otherwise an exception is raised
    SELECT id INTO STRICT general_cat_id FROM public.room_categories WHERE name = 'General';
    SELECT id INTO STRICT design_cat_id FROM public.room_categories WHERE name = 'Design';

    -- Create discussion rooms and capture their IDs
    INSERT INTO public.discussion_rooms (name, description, is_private, category_id, created_by) VALUES
    ('General Chat', 'A place for everyone to chat about anything.', false, general_cat_id, 'a1b2c3d4-e5f6-7890-1234-567890abcdef') RETURNING id INTO general_room_id;
    INSERT INTO public.discussion_rooms (name, description, is_private, category_id, created_by) VALUES
    ('Design Hangout', 'A private room for designers.', true, design_cat_id, 'b2c3d4e5-f6a7-8901-2345-67890abcdef0') RETURNING id INTO design_room_id;

    -- Add messages to the rooms
    INSERT INTO public.room_messages (room_id, user_id, content) VALUES
    (general_room_id, 'a1b2c3d4-e5f6-7890-1234-567890abcdef', 'Hello everyone, welcome to the general chat!'),
    (general_room_id, 'b2c3d4e5-f6a7-8901-2345-67890abcdef0', 'Hey there! Glad to be here.') RETURNING id INTO message1_id;

    INSERT INTO public.room_messages (room_id, user_id, content) VALUES
    (design_room_id, 'b2c3d4e5-f6a7-8901-2345-67890abcdef0', 'Welcome to the design hangout. Let''s talk about some cool UI stuff.');

    -- Add a reaction to a message
    INSERT INTO public.message_reactions (message_id, user_id, emoji) VALUES
    (message1_id, 'a1b2c3d4-e5f6-7890-1234-567890abcdef', '👋');
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE EXCEPTION 'Seed failed: A required room category (''General'' or ''Design'') was not found.';
END$$;

COMMIT;
