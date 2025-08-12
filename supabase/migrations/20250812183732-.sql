-- Fix critical security vulnerability: Protect user audio files and metadata
-- Add user ownership and proper access controls

-- First, add user_id column to track ownership of audio samples
ALTER TABLE public.audio_samples 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update existing records to have a placeholder user_id (they'll be orphaned but visible)
-- In production, you might want to assign these to a system user or delete them
UPDATE public.audio_samples 
SET user_id = '00000000-0000-0000-0000-000000000000'::uuid 
WHERE user_id IS NULL;

-- Make user_id required for new records
ALTER TABLE public.audio_samples 
ALTER COLUMN user_id SET NOT NULL;

-- Drop the overly permissive existing policies
DROP POLICY IF EXISTS "Anyone can view audio samples" ON public.audio_samples;
DROP POLICY IF EXISTS "Anyone can update audio samples" ON public.audio_samples;
DROP POLICY IF EXISTS "Anyone can insert audio samples" ON public.audio_samples;
DROP POLICY IF EXISTS "Anyone can delete audio samples" ON public.audio_samples;

-- Create secure user-based policies
-- Users can view their own audio samples
CREATE POLICY "Users can view their own audio samples" 
ON public.audio_samples 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own audio samples
CREATE POLICY "Users can upload their own audio samples" 
ON public.audio_samples 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own audio samples
CREATE POLICY "Users can update their own audio samples" 
ON public.audio_samples 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own audio samples
CREATE POLICY "Users can delete their own audio samples" 
ON public.audio_samples 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Block all public access
CREATE POLICY "Block public access to audio samples" 
ON public.audio_samples 
FOR ALL 
TO public 
USING (false);

-- Secure the storage bucket policies for audio uploads
-- Users can only upload to their own folder
CREATE POLICY "Users can upload to their own folder" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'audio-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can view their own uploaded files
CREATE POLICY "Users can view their own audio files" 
ON storage.objects 
FOR SELECT 
TO authenticated
USING (bucket_id = 'audio-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can update their own uploaded files
CREATE POLICY "Users can update their own audio files" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (bucket_id = 'audio-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own uploaded files
CREATE POLICY "Users can delete their own audio files" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (bucket_id = 'audio-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add helpful comments
COMMENT ON TABLE public.audio_samples IS 'User audio samples with secure access controls';
COMMENT ON COLUMN public.audio_samples.user_id IS 'Owner of the audio sample - prevents unauthorized access';

-- Create index for better performance on user queries
CREATE INDEX IF NOT EXISTS idx_audio_samples_user_id ON public.audio_samples(user_id);