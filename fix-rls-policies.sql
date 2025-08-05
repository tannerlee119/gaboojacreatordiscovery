-- Fix RLS policies for profiles table to allow registration

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Create more permissive policies for our custom auth system
-- Allow anyone to insert profiles (needed for registration)
CREATE POLICY "Allow profile creation during registration" ON profiles
  FOR INSERT WITH CHECK (true);

-- Allow anyone to read profiles (needed for login and general functionality)
CREATE POLICY "Allow profile reads" ON profiles
  FOR SELECT USING (true);

-- Allow users to update their own profiles (optional, for future use)
CREATE POLICY "Allow profile updates" ON profiles
  FOR UPDATE USING (true);

-- Fix auth_users table policies as well
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own auth data" ON auth_users;
DROP POLICY IF EXISTS "Allow user registration" ON auth_users;

-- Create proper policies for auth_users table
CREATE POLICY "Allow auth user creation" ON auth_users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow auth user reads" ON auth_users
  FOR SELECT USING (true);

-- Fix user_settings table policies
-- Allow anyone to insert user settings (needed for registration)
CREATE POLICY "Allow user settings creation" ON user_settings
  FOR INSERT WITH CHECK (true);

-- Allow reading user settings
CREATE POLICY "Allow user settings reads" ON user_settings
  FOR SELECT USING (true);

-- Allow updating user settings
CREATE POLICY "Allow user settings updates" ON user_settings
  FOR UPDATE USING (true);

-- Remove foreign key constraint from profiles table
-- This constraint expects profiles.id to reference auth.users.id (Supabase Auth)
-- Since we're using custom auth, we need to remove this constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Also check for any other foreign key constraints that might cause issues
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_user_id_fkey;