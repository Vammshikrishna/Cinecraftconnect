-- Add categories, tags, and last activity to discussion_rooms
ALTER TABLE public.discussion_rooms 
ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.room_categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_activity_at timestamp with time zone DEFAULT now();

-- Create message reactions table
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.room_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_reaction UNIQUE (message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for message_reactions
CREATE POLICY "Users can view all reactions" ON public.message_reactions FOR SELECT USING (true);
CREATE POLICY "Users can insert their own reactions" ON public.message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own reactions" ON public.message_reactions FOR DELETE USING (auth.uid() = user_id);

-- Function to update last_activity_at on new message
CREATE OR REPLACE FUNCTION public.update_room_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.discussion_rooms
  SET last_activity_at = now()
  WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_activity_at on new room_message
CREATE TRIGGER on_new_message_update_room_activity
AFTER INSERT ON public.room_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_room_last_activity();
