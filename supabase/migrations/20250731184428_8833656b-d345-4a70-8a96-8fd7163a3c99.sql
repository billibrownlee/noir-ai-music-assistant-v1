-- Create a table to store musical training data extracted from uploaded audio samples
CREATE TABLE public.audio_training_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sample_id UUID NOT NULL,
  musical_features JSONB NOT NULL,
  genre TEXT NOT NULL,
  confidence_score REAL DEFAULT 0.5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Foreign key to audio_samples table
  CONSTRAINT fk_audio_training_data_sample_id 
    FOREIGN KEY (sample_id) 
    REFERENCES public.audio_samples(id) 
    ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.audio_training_data ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since samples are public)
CREATE POLICY "Anyone can view training data" 
ON public.audio_training_data 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert training data" 
ON public.audio_training_data 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update training data" 
ON public.audio_training_data 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete training data" 
ON public.audio_training_data 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_training_data_updated_at
BEFORE UPDATE ON public.audio_training_data
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_audio_training_data_sample_id ON public.audio_training_data(sample_id);
CREATE INDEX idx_audio_training_data_genre ON public.audio_training_data(genre);
CREATE INDEX idx_audio_training_data_confidence ON public.audio_training_data(confidence_score);

-- Add a column to audio_samples to track if training data has been extracted
ALTER TABLE public.audio_samples 
ADD COLUMN training_extracted BOOLEAN DEFAULT false;