-- Create storage bucket for audio files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('audio-uploads', 'audio-uploads', true);

-- Create policies for audio uploads
CREATE POLICY "Public can view audio files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'audio-uploads');

CREATE POLICY "Anyone can upload audio files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'audio-uploads');

CREATE POLICY "Anyone can update audio files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'audio-uploads');

CREATE POLICY "Anyone can delete audio files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'audio-uploads');

-- Create table to track audio uploads and metadata
CREATE TABLE public.audio_samples (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  duration REAL,
  bpm INTEGER,
  key TEXT,
  genre TEXT,
  tags TEXT[],
  analysis_data JSONB,
  upload_status TEXT DEFAULT 'uploading' CHECK (upload_status IN ('uploading', 'completed', 'failed', 'processing')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on audio_samples table
ALTER TABLE public.audio_samples ENABLE ROW LEVEL SECURITY;

-- Create policies for audio_samples table
CREATE POLICY "Anyone can view audio samples" 
ON public.audio_samples 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert audio samples" 
ON public.audio_samples 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update audio samples" 
ON public.audio_samples 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete audio samples" 
ON public.audio_samples 
FOR DELETE 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_audio_samples_updated_at
  BEFORE UPDATE ON public.audio_samples
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();