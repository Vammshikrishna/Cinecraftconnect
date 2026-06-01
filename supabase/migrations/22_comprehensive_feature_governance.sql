-- ============================================================
-- 22_comprehensive_feature_governance.sql
-- CineCraft Connect — Root Feature Flags Expansion
-- ============================================================

-- 1. Insert New Platform Feature Flags
INSERT INTO public.platform_flags (key, value, description)
VALUES 
  ('post_creation_enabled', true, 'Allow users to create and publish new posts/content'),
  ('messaging_enabled', true, 'Enable real-time direct messaging between users'),
  ('talent_network_enabled', true, 'Allow browsing and searching the talent network'),
  ('project_creation_enabled', true, 'Enable the creation of new professional projects'),
  ('monetization_enabled', true, 'Enable platform-wide payment processing and commissions')
ON CONFLICT (key) DO NOTHING;
-- 2. Ensure existing flags have correct descriptions
UPDATE public.platform_flags SET description = 'Emergency lockdown: Disables all write operations across the platform.' WHERE key = 'global_lock';
UPDATE public.platform_flags SET description = 'Maintenance mode: Only staff can access the application.' WHERE key = 'maintenance_mode';
UPDATE public.platform_flags SET description = 'Enable the Equipment & Location Marketplace' WHERE key = 'marketplace_enabled';
UPDATE public.platform_flags SET description = 'Allow users to post new job listings' WHERE key = 'job_posting_enabled';
UPDATE public.platform_flags SET description = 'Enable Discussion Rooms feature' WHERE key = 'discussion_rooms_enabled';
UPDATE public.platform_flags SET description = 'Allow new users to register on the platform' WHERE key = 'user_registration_enabled';
UPDATE public.platform_flags SET description = 'Allow users to submit verification requests' WHERE key = 'verification_requests_enabled';
