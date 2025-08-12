-- Fix critical security vulnerability: Protect user-generated music content
-- Add user ownership and proper access controls

-- First, add user_id column to track ownership
ALTER TABLE public.saved_generated_music 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update existing records to have a placeholder user_id (they'll be orphaned but visible)
-- In production, you might want to assign these to a system user or delete them
UPDATE public.saved_generated_music 
SET user_id = '00000000-0000-0000-0000-000000000000'::uuid 
WHERE user_id IS NULL;

-- Make user_id required for new records
ALTER TABLE public.saved_generated_music 
ALTER COLUMN user_id SET NOT NULL;

-- Drop the overly permissive existing policies
DROP POLICY IF EXISTS "Anyone can view saved music" ON public.saved_generated_music;
DROP POLICY IF EXISTS "Anyone can insert saved music" ON public.saved_generated_music;
DROP POLICY IF EXISTS "Anyone can delete saved music" ON public.saved_generated_music;

-- Create user-based security policies
-- Users can view their own generated music
CREATE POLICY "Users can view their own music" 
ON public.saved_generated_music 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own music
CREATE POLICY "Users can save their own music" 
ON public.saved_generated_music 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own music metadata
CREATE POLICY "Users can update their own music" 
ON public.saved_generated_music 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own music
CREATE POLICY "Users can delete their own music" 
ON public.saved_generated_music 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Block all public access
CREATE POLICY "Block public access to saved music" 
ON public.saved_generated_music 
FOR ALL 
TO public 
USING (false);

-- Create user profiles table for additional user data
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies - users can view all profiles (for sharing features)
CREATE POLICY "Profiles are publicly viewable" 
ON public.profiles 
FOR SELECT 
USING (true);

-- Users can only update their own profile
CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

-- Create function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

-- Trigger to auto-create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add trigger for updating timestamps
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add helpful comments
COMMENT ON TABLE public.saved_generated_music IS 'User-generated music content with proper access controls';
COMMENT ON COLUMN public.saved_generated_music.user_id IS 'Owner of the generated music content';
COMMENT ON TABLE public.profiles IS 'User profiles for authentication and personalization';