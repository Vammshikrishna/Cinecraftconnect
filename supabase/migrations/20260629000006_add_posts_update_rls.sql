-- Add missing RLS policies for updating and deleting posts

CREATE POLICY "Users can update their own posts" ON "public"."posts" 
FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can delete their own posts" ON "public"."posts" 
FOR DELETE USING (auth.uid() = author_id);

-- Allow page managers to update/delete posts created for their page
CREATE POLICY "Page managers can update page posts" ON "public"."posts" 
FOR UPDATE USING (
  page_id IN (
    SELECT id FROM company_pages WHERE owner_id = auth.uid()
    UNION
    SELECT page_id FROM company_page_admins WHERE user_id = auth.uid()
    UNION
    SELECT page_id FROM company_page_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Page managers can delete page posts" ON "public"."posts" 
FOR DELETE USING (
  page_id IN (
    SELECT id FROM company_pages WHERE owner_id = auth.uid()
    UNION
    SELECT page_id FROM company_page_admins WHERE user_id = auth.uid()
    UNION
    SELECT page_id FROM company_page_members WHERE user_id = auth.uid()
  )
);