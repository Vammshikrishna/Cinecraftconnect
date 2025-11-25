-- Clean up existing data to make the script idempotent
DELETE FROM public.comments;
DELETE FROM public.likes;
DELETE FROM public.posts;
DELETE FROM public.project_space_members;
DELETE FROM public.project_spaces;
DELETE FROM public.discussion_rooms;
DELETE FROM public.announcements;
DELETE FROM public.profiles WHERE id = '8a76e641-9494-4369-a864-d249b5c393a5';
DELETE FROM auth.users WHERE id = '8a76e641-9494-4369-a864-d249b5c393a5';

-- Create a test user
-- A profile for this user will be created automatically by a trigger.
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('8a76e641-9494-4369-a864-d249b5c393a5', 'test@example.com', '{"username": "testuser", "full_name": "Test User"}');

-- Update the auto-created profile with additional details
UPDATE public.profiles
SET
    username = 'testuser',
    full_name = 'Test User',
    avatar_url = 'https://i.pravatar.cc/150?u=testuser',
    bio = 'I am a test user for this amazing app.',
    location = 'Los Angeles, CA',
    craft = 'QA Tester'
WHERE id = '8a76e641-9494-4369-a864-d249b5c393a5';

-- Seed the project_spaces table
INSERT INTO public.project_spaces (name, description, creator_id, project_space_type, status)
SELECT
    'Project ' || i,
    'This is a description for project ' || i,
    '8a76e641-9494-4369-a864-d249b5c393a5',
    'public',
    'In-Production'
FROM generate_series(1, 10) AS i;

-- Seed the posts table
INSERT INTO public.posts (author_id, content)
SELECT
    '8a76e641-9494-4369-a864-d249b5c393a5',
    'This is a post with some interesting content: ' || md5(random()::text)
FROM generate_series(1, 10);

-- Seed comments for the first post
INSERT INTO public.comments (post_id, user_id, content)
SELECT
    (SELECT id FROM public.posts LIMIT 1),
    '8a76e641-9494-4369-a864-d249b5c393a5',
    'This is a comment on the first post: ' || md5(random()::text)
FROM generate_series(1, 5);

-- Seed likes for the first post
INSERT INTO public.likes (post_id, user_id)
VALUES ((SELECT id FROM public.posts LIMIT 1), '8a76e641-9494-4369-a864-d249b5c393a5');

-- Seed discussion_rooms table
INSERT INTO public.discussion_rooms (title, name, description, creator_id, is_public)
SELECT
    'Discussion Room ' || i,
    'Discussion Room ' || i,
    'This is a description for discussion room ' || i,
    '8a76e641-9494-4369-a864-d249b5c393a5',
    true
FROM generate_series(1, 5) AS i;

-- Seed announcements table
INSERT INTO public.announcements (title, content, author_id)
SELECT
    'Announcement ' || i,
    'This is the content for announcement ' || i,
    '8a76e641-9494-4369-a864-d249b5c393a5'
FROM generate_series(1, 5) AS i;
