-- social_connections.sql

CREATE TABLE IF NOT EXISTS public.user_connections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

-- Enable RLS
ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own connections" ON public.user_connections 
FOR SELECT USING (follower_id = auth.uid() OR following_id = auth.uid());

CREATE POLICY "Users can follow others" ON public.user_connections 
FOR INSERT WITH CHECK (follower_id = auth.uid());

CREATE POLICY "Users can remove connections" ON public.user_connections 
FOR DELETE USING (follower_id = auth.uid() OR following_id = auth.uid());

-- Optional: Connection count trigger or RPC
CREATE OR REPLACE FUNCTION public.get_follower_count(target_user_id uuid)
RETURNS bigint AS $$
  SELECT count(*) FROM public.user_connections WHERE following_id = target_user_id AND status = 'accepted';
$$ LANGUAGE sql STABLE SECURITY DEFINER;
