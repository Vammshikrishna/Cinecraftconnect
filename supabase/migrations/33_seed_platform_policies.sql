-- ============================================================
-- 33_seed_platform_policies.sql
-- CineCraft Connect — Initial Governance Documents
-- ============================================================

-- First, ensure the 'type' column is unique to allow UPSERT operations
-- We use a DO block to avoid errors if the constraint already exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_policies_type_key') THEN
        ALTER TABLE public.platform_policies ADD CONSTRAINT platform_policies_type_key UNIQUE (type);
    END IF;
END $$;

-- Insert starter content for Documentation, Community Guidelines, and Terms.
-- Note: 'version' column was removed as it doesn't exist in the current schema.

INSERT INTO public.platform_policies (type, title, content, is_active)
VALUES 
(
  'community-guidelines', 
  'Community Guidelines', 
  'Welcome to CineCraft Connect. To maintain a professional and creative environment, we expect all members to:
1. Respect fellow creators and their intellectual property.
2. Maintain professional conduct in all interactions.
3. Refrain from posting offensive or unauthorized content.
4. Use our marketplace and vendor tools fairly and transparently.

Failure to follow these guidelines may result in account restrictions or permanent suspension.', 
  true
),
(
  'terms', 
  'Terms of Service', 
  'By using CineCraft Connect, you agree to our terms of service. This platform is designed for professional film and media creators. 

- All users must provide accurate identity information.
- We reserve the right to moderate content that violates our standards.
- Payments and marketplace transactions are subject to our service fees.
- Account security is the responsibility of the user.

Please contact support for any questions regarding these terms.', 
  true
),
(
  'privacy', 
  'Privacy Policy', 
  'Your privacy is critical to us. We collect minimal data necessary to provide our services. 
- We do not sell your personal data to third parties.
- Professional profile data is public to allow for network discovery.
- Messaging and project data are encrypted and private.

Check our full privacy settings for more control.', 
  true
)
ON CONFLICT (type) DO UPDATE 
SET 
  content = EXCLUDED.content, 
  title = EXCLUDED.title,
  updated_at = now();
