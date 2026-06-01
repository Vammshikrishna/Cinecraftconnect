-- Drop existing policies if they exist to avoid duplication/errors
DROP POLICY IF EXISTS "Anyone view skills" ON public.user_skills;
DROP POLICY IF EXISTS "Users manage own skills" ON public.user_skills;
DROP POLICY IF EXISTS "Users can manage own skills" ON public.user_skills;
DROP POLICY IF EXISTS "Users can manage own experience" ON public.user_experience;
DROP POLICY IF EXISTS "Users manage own experience" ON public.user_experience;
DROP POLICY IF EXISTS "Anyone view experience" ON public.user_experience;

-- Enable RLS (already enabled, but let's ensure it is)
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_experience ENABLE ROW LEVEL SECURITY;

-- Create public read policies
CREATE POLICY "Anyone view skills" ON public.user_skills
    FOR SELECT TO public USING (true);

CREATE POLICY "Anyone view experience" ON public.user_experience
    FOR SELECT TO public USING (true);

-- Create manage policies for owners
CREATE POLICY "Users manage own skills" ON public.user_skills
    FOR ALL TO public USING (auth.uid() = user_id);

CREATE POLICY "Users manage own experience" ON public.user_experience
    FOR ALL TO public USING (auth.uid() = user_id);
