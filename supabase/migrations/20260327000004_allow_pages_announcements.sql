-- Add publisher_page_id to announcements
ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS publisher_page_id UUID REFERENCES public.company_pages(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_announcements_publisher_page_id ON public.announcements(publisher_page_id);

-- Update RLS policies to allow page admins to manage announcements
-- Drop existing policies if needed or just add specific ones
DROP POLICY IF EXISTS "Page admins can manage page announcements" ON public.announcements;
CREATE POLICY "Page admins can manage page announcements" ON public.announcements
FOR ALL USING (
    (publisher_page_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.company_pages
        WHERE id = publisher_page_id AND (owner_id = auth.uid())
    ))
    OR
    (publisher_page_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.company_page_admins
        WHERE page_id = publisher_page_id AND user_id = auth.uid()
    ))
);

-- Note: The existing "Author Manage Announcements" already covers author_id based posts.
