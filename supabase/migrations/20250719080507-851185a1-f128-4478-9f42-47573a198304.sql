-- Drop unused tables from the database schema

-- Drop localized_files table (replaced by code_transformations)
DROP TABLE IF EXISTS public.localized_files;

-- Drop profiles table (not used in current implementation)
DROP TABLE IF EXISTS public.profiles;

-- Drop the trigger for profiles table if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop the function for handling new users if it exists
DROP FUNCTION IF EXISTS public.handle_new_user();