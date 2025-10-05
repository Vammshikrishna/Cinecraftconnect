-- Add category_id and tags to discussion_rooms if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'discussion_rooms' AND column_name = 'category_id') THEN
    ALTER TABLE public.discussion_rooms ADD COLUMN category_id uuid REFERENCES public.room_categories(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'discussion_rooms' AND column_name = 'tags') THEN
    ALTER TABLE public.discussion_rooms ADD COLUMN tags text[] DEFAULT '{}';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'discussion_rooms' AND column_name = 'last_activity_at') THEN
    ALTER TABLE public.discussion_rooms ADD COLUMN last_activity_at timestamp with time zone DEFAULT now();
  END IF;
END $$;

-- Create message reactions table if not exists
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.room_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Enable RLS on message_reactions
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for message_reactions
DROP POLICY IF EXISTS "Room members can view reactions" ON public.message_reactions;
CREATE POLICY "Room members can view reactions"
ON public.message_reactions
FOR SELECT
TO authenticated
USING (
  message_id IN (
    SELECT id FROM public.room_messages 
    WHERE room_id IN (
      SELECT room_id FROM public.room_members WHERE user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Users can add reactions" ON public.message_reactions;
CREATE POLICY "Users can add reactions"
ON public.message_reactions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove their reactions" ON public.message_reactions;
CREATE POLICY "Users can remove their reactions"
ON public.message_reactions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Function to update last_activity_at when messages are sent
CREATE OR REPLACE FUNCTION update_room_last_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.discussion_rooms 
  SET last_activity_at = now() 
  WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$;

-- Trigger to update last activity
DROP TRIGGER IF EXISTS room_message_activity_trigger ON public.room_messages;
CREATE TRIGGER room_message_activity_trigger
AFTER INSERT ON public.room_messages
FOR EACH ROW
EXECUTE FUNCTION update_room_last_activity();