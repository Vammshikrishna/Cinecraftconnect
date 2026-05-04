-- 37_hide_internal_users.sql

-- 1. Add is_internal column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_internal boolean DEFAULT false;

-- 2. Create a helper function to check if the current auth.uid() is an internal user
CREATE OR REPLACE FUNCTION public.is_current_user_internal()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'moderator', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create a trigger function to keep profiles.is_internal in sync with user_roles
CREATE OR REPLACE FUNCTION public.sync_is_internal_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.role IN ('admin', 'moderator', 'super_admin') THEN
      UPDATE public.profiles SET is_internal = true WHERE id = NEW.user_id;
    ELSE
      UPDATE public.profiles SET is_internal = false WHERE id = NEW.user_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET is_internal = false WHERE id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach trigger to user_roles
DROP TRIGGER IF EXISTS user_roles_sync_is_internal ON public.user_roles;
CREATE TRIGGER user_roles_sync_is_internal
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE PROCEDURE public.sync_is_internal_trigger();

-- 5. Backfill existing internal users
UPDATE public.profiles
SET is_internal = true
WHERE id IN (
  SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'moderator', 'super_admin')
);

-- 6. Update the RLS policy on profiles to hide internal users from public view
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (
  id = auth.uid()
  OR is_internal = false
  OR public.is_current_user_internal()
);
