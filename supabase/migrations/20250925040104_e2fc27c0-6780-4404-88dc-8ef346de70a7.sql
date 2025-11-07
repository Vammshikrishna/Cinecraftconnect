-- Fix security issue: Restrict profile visibility to authenticated users only
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

-- Create new policy that only allows authenticated users to view profiles
CREATE POLICY "Authenticated users can view profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (true);

-- Keep the existing policy for users to update their own profile
-- (This policy already exists and is secure)
