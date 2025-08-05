-- Fix database schema for custom authentication system
-- This updates the existing schema to work with custom auth_users table instead of Supabase auth.users

-- 1. Create auth_users table (if not exists)
CREATE TABLE IF NOT EXISTS auth_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Drop existing foreign key constraints that reference auth.users
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_user_id_fkey;
ALTER TABLE user_bookmarks DROP CONSTRAINT IF EXISTS user_bookmarks_user_id_fkey;
ALTER TABLE user_search_history DROP CONSTRAINT IF EXISTS user_search_history_user_id_fkey;
ALTER TABLE creator_analyses DROP CONSTRAINT IF EXISTS creator_analyses_analyzed_by_user_id_fkey;
ALTER TABLE api_usage_logs DROP CONSTRAINT IF EXISTS api_usage_logs_user_id_fkey;
ALTER TABLE rate_limit_logs DROP CONSTRAINT IF EXISTS rate_limit_logs_user_id_fkey;

-- 3. Update profiles table to reference auth_users instead of auth.users
-- Keep existing data, just remove the foreign key constraint
-- Note: profiles.id should match auth_users.id for existing users

-- 4. Update user_settings to reference auth_users
-- Note: user_settings.user_id should match auth_users.id

-- 5. Update user_bookmarks to reference auth_users
-- Note: user_bookmarks.user_id should match auth_users.id

-- 6. Update user_search_history to reference auth_users
-- Note: user_search_history.user_id should match auth_users.id

-- 7. Update creator_analyses to reference auth_users
-- Note: creator_analyses.analyzed_by_user_id should match auth_users.id (can be NULL)

-- 8. Drop and recreate RLS policies to work without auth.uid()
-- Drop existing policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

DROP POLICY IF EXISTS "Users can view their own bookmarks" ON user_bookmarks;
DROP POLICY IF EXISTS "Users can insert their own bookmarks" ON user_bookmarks;
DROP POLICY IF EXISTS "Users can update their own bookmarks" ON user_bookmarks;
DROP POLICY IF EXISTS "Users can delete their own bookmarks" ON user_bookmarks;

DROP POLICY IF EXISTS "Users can view their own search history" ON user_search_history;
DROP POLICY IF EXISTS "Users can insert their own search history" ON user_search_history;
DROP POLICY IF EXISTS "Users can delete their own search history" ON user_search_history;

DROP POLICY IF EXISTS "Users can view their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON user_settings;

-- Create permissive policies for custom auth (since we handle auth in application layer)
CREATE POLICY "Allow profile access" ON profiles FOR ALL USING (true);
CREATE POLICY "Allow bookmark access" ON user_bookmarks FOR ALL USING (true);
CREATE POLICY "Allow search history access" ON user_search_history FOR ALL USING (true);
CREATE POLICY "Allow settings access" ON user_settings FOR ALL USING (true);

-- 9. Drop and recreate the handle_new_user function and trigger
-- This was designed for Supabase auth, we don't need it for custom auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 10. Update the database functions to work without auth dependencies
-- The get_or_create_creator function should work as-is since it doesn't reference auth

-- 11. Add index on auth_users for performance
CREATE INDEX IF NOT EXISTS idx_auth_users_username ON auth_users(username);

-- 12. Add updated_at trigger for auth_users
CREATE TRIGGER update_auth_users_updated_at BEFORE UPDATE ON auth_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 13. Optional: Disable RLS entirely for simplicity (less secure but simpler)
-- Uncomment these lines if you want to completely disable RLS
-- ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_bookmarks DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_search_history DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_settings DISABLE ROW LEVEL SECURITY;