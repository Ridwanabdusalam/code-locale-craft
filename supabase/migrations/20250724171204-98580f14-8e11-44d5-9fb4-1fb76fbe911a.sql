-- Create profiles table for GitHub user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  github_id TEXT UNIQUE,
  github_username TEXT,
  github_avatar_url TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create github_tokens table for secure token storage
CREATE TABLE public.github_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  token_type TEXT DEFAULT 'bearer',
  scope TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on both tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles table
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create policies for github_tokens table
CREATE POLICY "Users can view their own GitHub tokens" 
ON public.github_tokens 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own GitHub tokens" 
ON public.github_tokens 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own GitHub tokens" 
ON public.github_tokens 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own GitHub tokens" 
ON public.github_tokens 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic profile creation on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, github_id, github_username, github_avatar_url, full_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'provider_id',
    NEW.raw_user_meta_data ->> 'user_name',
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.raw_user_meta_data ->> 'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to handle new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add updated_at trigger for profiles
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add updated_at trigger for github_tokens
CREATE TRIGGER update_github_tokens_updated_at
BEFORE UPDATE ON public.github_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();