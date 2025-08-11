-- Fix security vulnerability: Restrict translation cache access to authenticated users only
-- Remove the publicly readable policy and replace with authenticated-only access

-- Drop the existing public read policy
DROP POLICY IF EXISTS "Translation cache is publicly readable" ON public.translation_cache;

-- Create new policy that restricts access to authenticated users only
CREATE POLICY "Authenticated users can read translation cache" 
ON public.translation_cache 
FOR SELECT 
TO authenticated
USING (true);

-- Update the insert policy to be more explicit about authentication requirement
DROP POLICY IF EXISTS "System can insert into translation cache" ON public.translation_cache;

CREATE POLICY "Authenticated users can insert into translation cache" 
ON public.translation_cache 
FOR INSERT 
TO authenticated
WITH CHECK (true);