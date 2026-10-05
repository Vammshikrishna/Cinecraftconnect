-- Add settings and pinned_message_id columns to project_spaces
ALTER TABLE public.project_spaces 
ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{"allow_member_edit": false, "allow_member_chat": true, "allow_member_invite": false}'::jsonb,
ADD COLUMN IF NOT EXISTS pinned_message_id uuid REFERENCES public.project_space_messages(id) ON DELETE SET NULL;

-- Backfill existing project spaces with default settings
UPDATE public.project_spaces 
SET settings = '{"allow_member_edit": false, "allow_member_chat": true, "allow_member_invite": false}'::jsonb 
WHERE settings IS NULL;

-- Add category column to files table
ALTER TABLE public.files 
ADD COLUMN IF NOT EXISTS category text;
