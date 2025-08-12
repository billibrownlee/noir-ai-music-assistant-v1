-- Fix critical security vulnerability: Protect user audio files and metadata
-- Add user ownership and proper access controls (fixed version)

-- First, add user_id column as nullable initially
ALTER TABLE public.audio_samples 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Leave existing records with NULL user_id (they'll be handled by special policy)

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

-- Allow viewing of legacy samples (with NULL user_id) for backward compatibility
-- This is temporary until all samples have proper ownership
CREATE POLICY "Legacy audio samples are viewable" 
ON public.audio_samples 
FOR SELECT 
TO authenticated
USING (user_id IS NULL);

-- Users can insert their own audio samples (must include user_id)
CREATE POLICY "Users can upload their own audio samples" 
ON public.audio_samples 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

-- Users can update their own audio samples
CREATE POLICY "Users can update their own audio samples" 
ON public.audio_samples 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id AND user_id IS NOT NULL)
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

-- Users can delete their own audio samples
CREATE POLICY "Users can delete their own audio samples" 
ON public.audio_samples 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- Allow authenticated users to claim legacy samples by updating them with their user_id
CREATE POLICY "Users can claim legacy audio samples" 
ON public.audio_samples 
FOR UPDATE 
TO authenticated
USING (user_id IS NULL)
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

-- Block all public access
CREATE POLICY "Block public access to audio samples" 
ON public.audio_samples 
FOR ALL 
TO public 
USING (false);

-- Secure the storage bucket policies for audio uploads
-- First drop any existing policies that might conflict
DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own audio files" ON storage.objects;

-- Users can only upload to their own folder in audio-uploads bucket
CREATE POLICY "Authenticated users can upload to their folder" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'audio-uploads' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their own uploaded files
CREATE POLICY "Users can view their own audio files" 
ON storage.objects 
FOR SELECT 
TO authenticated
USING (
  bucket_id = 'audio-uploads' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can update their own uploaded files
CREATE POLICY "Users can update their own audio files" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (
  bucket_id = 'audio-uploads' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own uploaded files
CREATE POLICY "Users can delete their own audio files" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (
  bucket_id = 'audio-uploads' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Add helpful comments
COMMENT ON TABLE public.audio_samples IS 'User audio samples with secure access controls';
COMMENT ON COLUMN public.audio_samples.user_id IS 'Owner of the audio sample - NULL for legacy samples';

-- Create index for better performance on user queries
CREATE INDEX IF NOT EXISTS idx_audio_samples_user_id ON public.audio_samples(user_id) WHERE user_id IS NOT NULL;