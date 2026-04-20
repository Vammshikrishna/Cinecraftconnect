-- Create project_ratings table
CREATE TABLE IF NOT EXISTS public.project_ratings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating numeric NOT NULL CHECK (rating >= 0 AND rating <= 5),
    review text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(project_id, user_id)
);

-- Enable RLS
ALTER TABLE public.project_ratings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view project ratings" ON public.project_ratings
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create ratings" ON public.project_ratings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ratings" ON public.project_ratings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ratings" ON public.project_ratings
    FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_project_ratings_updated_at
    BEFORE UPDATE ON public.project_ratings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
