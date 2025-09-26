-- Fix security issue: Restrict profile viewing to authenticated users only
-- Update the RLS policy for profiles table to require authentication

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Create a new policy that requires authentication
CREATE POLICY "Authenticated users can view profiles" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Also fix missing DELETE policy for direct_messages to allow users to delete their own messages
CREATE POLICY "Users can delete their own messages" 
ON public.direct_messages 
FOR DELETE 
USING ((sender_id = auth.uid()) OR (recipient_id = auth.uid()));

-- Fix missing INSERT policy for user_activities to allow system to track activities
CREATE POLICY "System can create user activities" 
ON public.user_activities 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);