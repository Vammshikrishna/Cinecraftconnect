-- Add room categories table
CREATE TABLE IF NOT EXISTS public.room_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  icon text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add category_id to discussion_rooms
ALTER TABLE public.discussion_rooms 
ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.room_categories(id),
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_activity_at timestamp with time zone DEFAULT now();

-- Create message reactions table
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.room_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Enable RLS on new tables
ALTER TABLE public.room_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for room_categories
CREATE POLICY "Anyone can view room categories"
ON public.room_categories
FOR SELECT
TO public
USING (true);

CREATE POLICY "Admins can manage categories"
ON public.room_categories
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for message_reactions
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

CREATE POLICY "Users can add reactions"
ON public.message_reactions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their reactions"
ON public.message_reactions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Insert default categories
INSERT INTO public.room_categories (name, description, icon) VALUES
  ('General Discussion', 'General filmmaking topics', '💬'),
  ('Screenwriting', 'Writing and story development', '✍️'),
  ('Cinematography', 'Camera work and visual storytelling', '🎥'),
  ('Post-Production', 'Editing, color, and VFX', '🎬'),
  ('Sound Design', 'Audio and music discussions', '🎵'),
  ('Networking', 'Connect with other filmmakers', '🤝')
ON CONFLICT (name) DO NOTHING;

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