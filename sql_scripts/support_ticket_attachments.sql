-- CineCraft Connect: Support Ticket Attachments
-- Provisions the infrastructure for visual evidence in support queries

-- 1. Add attachment column to tickets
ALTER TABLE public.support_tickets 
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- 2. Create Support Storage Bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('support', 'support', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Security Policies
-- Allow anyone to view support attachments (required for staff review)
CREATE POLICY "Public Access" ON storage.objects 
FOR SELECT USING (bucket_id = 'support');

-- Allow authenticated users to upload their own screenshots
CREATE POLICY "Users can upload support assets" ON storage.objects 
FOR INSERT WITH CHECK (
    bucket_id = 'support' 
    AND auth.role() = 'authenticated'
);

-- Allow Staff to manage/delete attachments if needed
CREATE POLICY "Staff can manage support assets" ON storage.objects
FOR ALL USING (
    bucket_id = 'support' 
    AND EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role::text IN ('moderator', 'admin', 'super_admin')
    )
);
