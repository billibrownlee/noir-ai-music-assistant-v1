-- Fix storage and database policies to allow uploads without authentication

-- First check and drop existing restrictive audio sample policies
DROP POLICY IF EXISTS "Users can view their own audio samples" ON public.audio_samples;
DROP POLICY IF EXISTS "Legacy audio samples are viewable" ON public.audio_samples; 
DROP POLICY IF EXISTS "Users can upload their own audio samples" ON public.audio_samples;
DROP POLICY IF EXISTS "Users can update their own audio samples" ON public.audio_samples;
DROP POLICY IF EXISTS "Users can delete their own audio samples" ON public.audio_samples;
DROP POLICY IF EXISTS "Users can claim legacy audio samples" ON public.audio_samples;
DROP POLICY IF EXISTS "Block public access to audio samples" ON public.audio_samples;

-- Create permissive policies for audio_samples table
CREATE POLICY "Public can view all audio samples" 
ON public.audio_samples 
FOR SELECT 
USING (true);

CREATE POLICY "Public can insert audio samples" 
ON public.audio_samples 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Public can update audio samples" 
ON public.audio_samples 
FOR UPDATE 
USING (true);

CREATE POLICY "Public can delete audio samples" 
ON public.audio_samples 
FOR DELETE 
USING (true);

-- Update storage policies only if needed - check what exists first
DO $$
BEGIN
    -- Drop storage policies if they exist
    DROP POLICY IF EXISTS "Authenticated users can upload to their folder" ON storage.objects;
    DROP POLICY IF EXISTS "Users can view their own audio files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update their own audio files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their own audio files" ON storage.objects;
    
    -- Only create storage policies if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Anyone can upload audio files'
    ) THEN
        EXECUTE 'CREATE POLICY "Anyone can upload audio files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = ''audio-uploads'')';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Anyone can view audio files'
    ) THEN
        EXECUTE 'CREATE POLICY "Anyone can view audio files" ON storage.objects FOR SELECT USING (bucket_id = ''audio-uploads'')';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Anyone can update audio files'
    ) THEN
        EXECUTE 'CREATE POLICY "Anyone can update audio files" ON storage.objects FOR UPDATE USING (bucket_id = ''audio-uploads'')';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Anyone can delete audio files'
    ) THEN
        EXECUTE 'CREATE POLICY "Anyone can delete audio files" ON storage.objects FOR DELETE USING (bucket_id = ''audio-uploads'')';
    END IF;
END $$;

-- Add comment
COMMENT ON TABLE public.audio_samples IS 'Audio samples with public access for development testing';