-- Allow uploads without authentication for development
-- Update storage policies to be more permissive

-- Drop restrictive authenticated-only policies
DROP POLICY IF EXISTS "Authenticated users can upload to their folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own audio files" ON storage.objects;

-- Create more permissive policies for development
-- Allow anyone to upload to the audio-uploads bucket
CREATE POLICY "Anyone can upload audio files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'audio-uploads');

-- Allow anyone to view audio files in the bucket
CREATE POLICY "Anyone can view audio files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'audio-uploads');

-- Allow anyone to update audio files
CREATE POLICY "Anyone can update audio files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'audio-uploads');

-- Allow anyone to delete audio files
CREATE POLICY "Anyone can delete audio files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'audio-uploads');

-- Update the database policies to allow NULL user_id
-- Drop the restrictive policy that blocks public access to audio samples
DROP POLICY IF EXISTS "Block public access to audio samples" ON public.audio_samples;

-- Allow anyone to view audio samples (authenticated or not)
CREATE POLICY "Anyone can view audio samples" 
ON public.audio_samples 
FOR SELECT 
USING (true);

-- Allow anyone to insert audio samples
CREATE POLICY "Anyone can insert audio samples" 
ON public.audio_samples 
FOR INSERT 
WITH CHECK (true);

-- Allow anyone to update audio samples
CREATE POLICY "Anyone can update audio samples" 
ON public.audio_samples 
FOR UPDATE 
USING (true);

-- Allow anyone to delete audio samples
CREATE POLICY "Anyone can delete audio samples" 
ON public.audio_samples 
FOR DELETE 
USING (true);

-- Add helpful comment
COMMENT ON TABLE public.audio_samples IS 'Audio samples accessible without authentication for development';