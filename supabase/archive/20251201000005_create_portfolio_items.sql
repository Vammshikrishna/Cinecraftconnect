-- 20251201000005_create_portfolio_items.sql

-- Create portfolio_items table
CREATE TABLE IF NOT EXISTS public.portfolio_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    media_url text,
    media_type text, -- 'image', 'video', 'audio', 'document'
    project_type text,
    role text,
    completion_date date,
    tags text[],
    is_featured boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Public portfolio items are viewable by everyone" ON public.portfolio_items;
CREATE POLICY "Public portfolio items are viewable by everyone" ON public.portfolio_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own portfolio items" ON public.portfolio_items;
CREATE POLICY "Users can insert their own portfolio items" ON public.portfolio_items FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own portfolio items" ON public.portfolio_items;
CREATE POLICY "Users can update their own portfolio items" ON public.portfolio_items FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own portfolio items" ON public.portfolio_items;
CREATE POLICY "Users can delete their own portfolio items" ON public.portfolio_items FOR DELETE USING (auth.uid() = user_id);

-- Create updated_at trigger
DROP TRIGGER IF EXISTS update_portfolio_items_updated_at ON public.portfolio_items;
CREATE TRIGGER update_portfolio_items_updated_at BEFORE UPDATE ON public.portfolio_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
