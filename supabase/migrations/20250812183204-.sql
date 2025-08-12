-- Fix critical security vulnerability: Protect AI training data from public access
-- Remove overly permissive policies that allow anyone to access valuable training data

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can view training data" ON public.audio_training_data;
DROP POLICY IF EXISTS "Anyone can update training data" ON public.audio_training_data;
DROP POLICY IF EXISTS "Anyone can insert training data" ON public.audio_training_data;
DROP POLICY IF EXISTS "Anyone can delete training data" ON public.audio_training_data;

-- Create secure policies that only allow system operations
-- Only allow service role (edge functions) to insert training data
CREATE POLICY "System can insert training data" 
ON public.audio_training_data 
FOR INSERT 
TO service_role 
WITH CHECK (true);

-- Only allow service role to read training data for AI model operations  
CREATE POLICY "System can read training data" 
ON public.audio_training_data 
FOR SELECT 
TO service_role 
USING (true);

-- Only allow service role to update training data for system maintenance
CREATE POLICY "System can update training data" 
ON public.audio_training_data 
FOR UPDATE 
TO service_role 
USING (true);

-- Only allow service role to delete training data for cleanup operations
CREATE POLICY "System can delete training data" 
ON public.audio_training_data 
FOR DELETE 
TO service_role 
USING (true);

-- Ensure no public access by creating a restrictive default policy
CREATE POLICY "Block public access to training data" 
ON public.audio_training_data 
FOR ALL 
TO public 
USING (false);

-- Add comment for documentation
COMMENT ON TABLE public.audio_training_data IS 'AI training data - restricted to system operations only for IP protection';