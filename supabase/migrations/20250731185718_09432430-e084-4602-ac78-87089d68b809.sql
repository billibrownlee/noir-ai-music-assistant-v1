-- Create a table to store saved generated music
CREATE TABLE public.saved_generated_music (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_id TEXT NOT NULL, -- The original generated music ID
  prompt TEXT NOT NULL,
  original_prompt TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  duration INTEGER NOT NULL,
  style TEXT NOT NULL,
  instrumental BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL,
  generation_time REAL NOT NULL,
  saved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_generated_music ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since music is public)
CREATE POLICY "Anyone can view saved music" 
ON public.saved_generated_music 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert saved music" 
ON public.saved_generated_music 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can delete saved music" 
ON public.saved_generated_music 
FOR DELETE 
USING (true);

-- Create indexes for better performance
CREATE INDEX idx_saved_generated_music_style ON public.saved_generated_music(style);
CREATE INDEX idx_saved_generated_music_saved_at ON public.saved_generated_music(saved_at);