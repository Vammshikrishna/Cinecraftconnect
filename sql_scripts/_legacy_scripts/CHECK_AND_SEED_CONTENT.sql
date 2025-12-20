-- CHECK DATA
SELECT count(*) FROM public.posts;
SELECT count(*) FROM public.projects;
SELECT count(*) FROM public.profiles;

-- IF EMPTY, SEED BASIC DATA
INSERT INTO public.profiles (id, username, full_name, onboarding_completed, craft)
VALUES 
  ('00000000-0000-0000-0000-000000000000', 'demo_user', 'Demo User', true, 'Director')
ON CONFLICT DO NOTHING;

INSERT INTO public.posts (id, author_id, content, created_at)
VALUES 
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Welcome to CineCraft Connect! This is a first post.', now())
ON CONFLICT DO NOTHING;
