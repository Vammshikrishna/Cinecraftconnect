-- Fix recursion in room_members RLS by using a SECURITY DEFINER function

-- 1. Create a helper function to check membership without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_room_member(_room_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- This bypasses RLS for the query inside
SET search_path = public -- Good practice for security definers
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.room_members
    WHERE room_id = _room_id
    AND user_id = auth.uid()
  );
END;
$$;

-- 2. Drop the recursive policy
DROP POLICY IF EXISTS "Users can view members of rooms they belong to" ON public.room_members;

-- 3. Create the new non-recursive policy
CREATE POLICY "Users can view members of rooms they belong to"
ON public.room_members FOR SELECT
USING (
  public.is_room_member(room_id)
);
