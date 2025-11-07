-- Wrap the entire seed script in a transaction to ensure atomicity
BEGIN;

-- Create some sample users
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_token, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token_encrypted, confirmation_sent_at) VALUES
('00000000-0000-0000-0000-000000000000', 'a1b2c3d4-e5f6-7890-1234-567890abcdef', 'authenticated', 'authenticated', 'user1@example.com', 'encrypted_password_1', '2024-01-01 12:00:00+00', '', NULL, NULL, '{ "provider": "email", "providers": ["email"] }', '{}', '2024-01-01 12:00:00+00', '2024-01-01 12:00:00+00', '', '', '', '', NULL),
('00000000-0000-0000-0000-000000000000', 'b2c3d4e5-f6a7-8901-2345-67890abcdef0', 'authenticated', 'authenticated', 'user2@example.com', 'encrypted_password_2', '2024-01-01 12:00:00+00', '', NULL, NULL, '{ "provider": "email", "providers": ["email"] }', '{}', '2024-01-01 12:00:00+00', '2024-01-01 12:00:00+00', '', '', '', '', NULL);

-- Create some sample posts and capture their generated IDs
WITH new_posts AS (
  INSERT INTO posts (user_id, content) VALUES
  ('a1b2c3d4-e5f6-7890-1234-567890abcdef', 'This is the first post by user1!'),
  ('b2c3d4e5-f6a7-8901-2345-67890abcdef0', 'A second post, this one from user2.')
  RETURNING id, user_id
)
-- Create a sample share using the captured post ID
INSERT INTO shares (post_id, user_id)
SELECT
  (SELECT id FROM new_posts WHERE user_id = 'a1b2c3d4-e5f6-7890-1234-567890abcdef'), -- Select post ID from user1
  'b2c3d4e5-f6a7-8901-2345-67890abcdef0'; -- User2 is the one sharing

COMMIT;
