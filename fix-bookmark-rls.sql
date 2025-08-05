-- Fix RLS policies for bookmark-related tables to work with custom auth

-- Fix user_bookmarks table policies
-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage own bookmarks" ON user_bookmarks;
DROP POLICY IF EXISTS "Users can view own bookmarks" ON user_bookmarks;
DROP POLICY IF EXISTS "Users can insert own bookmarks" ON user_bookmarks;
DROP POLICY IF EXISTS "Users can update own bookmarks" ON user_bookmarks;
DROP POLICY IF EXISTS "Users can delete own bookmarks" ON user_bookmarks;

-- Create permissive policies for custom auth system
CREATE POLICY "Allow bookmark creation" ON user_bookmarks
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow bookmark reads" ON user_bookmarks
  FOR SELECT USING (true);

CREATE POLICY "Allow bookmark updates" ON user_bookmarks
  FOR UPDATE USING (true);

CREATE POLICY "Allow bookmark deletes" ON user_bookmarks
  FOR DELETE USING (true);

-- Fix creators table policies (needed for bookmark operations)
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view creators" ON creators;
DROP POLICY IF EXISTS "Users can insert creators" ON creators;

-- Create permissive policies
CREATE POLICY "Allow creator reads" ON creators
  FOR SELECT USING (true);

CREATE POLICY "Allow creator creation" ON creators
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow creator updates" ON creators
  FOR UPDATE USING (true);

-- Alternatively, if you want to completely disable RLS for these tables (simpler but less secure):
-- ALTER TABLE user_bookmarks DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE creators DISABLE ROW LEVEL SECURITY;