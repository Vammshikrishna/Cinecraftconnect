
-- Create the project_spaces table
CREATE TABLE IF NOT EXISTS public.project_spaces (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    name text NOT NULL,
    description text,
    creator_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create the project_space_members table
CREATE TABLE IF NOT EXISTS public.project_space_members (
    project_space_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (project_space_id, user_id)
);

-- Create the shot_list table
CREATE TABLE IF NOT EXISTS public.shot_list (
    id SERIAL PRIMARY KEY,
    project_space_id uuid REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    scene INTEGER,
    shot INTEGER,
    description TEXT
);
