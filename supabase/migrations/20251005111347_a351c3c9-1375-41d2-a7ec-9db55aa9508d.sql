
-- Phase 2: Content & Engagement Features
      
      CREATE TABLE IF NOT EXISTS public.room_categories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL UNIQUE,
        description text,
        icon text,
        created_at timestamp with time zone NOT NULL DEFAULT now()
      );
      
      -- Add category_id to discussion_rooms
      ALTER TABLE public.discussion_rooms 
      ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.room_categories(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS last_activity_at timestamp with time zone DEFAULT now();
      
      -- Create message reactions table
      CREATE TABLE IF NOT EXISTS public.message_reactions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id uuid NOT NULL REFERENCES public.room_messages(id) ON DELETE CASCADE,
        user_id uuid NOT NULL,
        emoji text NOT NULL,
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT unique_reaction UNIQUE (message_id, user_id, emoji)
      );
      
      ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
      
      -- Add RLS policies for message_reactions
      CREATE POLICY "Users can view all reactions" ON public.message_reactions FOR SELECT USING (true);
      CREATE POLICY "Users can insert their own reactions" ON public.message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
      CREATE POLICY "Users can delete their own reactions" ON public.message_reactions FOR DELETE USING (auth.uid() = user_id);
      
      -- Function to get a user's feed (posts from people they follow)
      CREATE OR REPLACE FUNCTION public.get_user_feed(p_user_id uuid)
      RETURNS TABLE(
          id uuid,
          created_at timestamp with time zone,
          title text,
          content text,
          media_urls text[],
          author_id uuid,
          author_full_name text,
          author_avatar_url text
      )
      LANGUAGE sql
      STABLE
      AS $$
        SELECT 
          p.id,
          p.created_at,
          p.title,
          p.content,
          p.media_urls,
          p.author_id,
          pr.full_name,
          pr.avatar_url
        FROM public.posts p
        JOIN public.user_connections c ON p.author_id = c.following_id
        JOIN public.profiles pr ON p.author_id = pr.id
        WHERE c.follower_id = p_user_id AND c.status = 'approved'
        ORDER BY p.created_at DESC;
      $$;
