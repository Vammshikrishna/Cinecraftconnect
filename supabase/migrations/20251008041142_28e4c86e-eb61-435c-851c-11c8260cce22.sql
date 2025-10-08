-- Add foreign key relationships for profiles in direct_messages table
-- This allows us to fetch sender and recipient profiles via foreign key relationships

-- First, ensure the direct_messages table exists and has the correct structure
-- The table should already exist, so we just need to ensure proper indexing

-- Add comment to clarify the foreign key relationships for Supabase's type generation
COMMENT ON COLUMN public.direct_messages.sender_id IS 'Foreign key to profiles table';
COMMENT ON COLUMN public.direct_messages.recipient_id IS 'Foreign key to profiles table';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_id ON public.direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient_id ON public.direct_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_created_at ON public.direct_messages(created_at DESC);
