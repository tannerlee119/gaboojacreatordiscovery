-- ====================================================================
-- GABOOJA CREATOR DISCOVERY - COMPLETE DATABASE SCHEMA
-- ====================================================================
-- This single file sets up everything needed for a fresh Supabase database
-- Includes: Authentication, Creator Discovery Pool, Analysis Tracking, User Management
-- Run this as a complete replacement for all previous schema files

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- ENUMS AND TYPES
-- ====================================================================

-- Creator Categories Enum
CREATE TYPE creator_category AS ENUM (
  'lifestyle', 'fashion', 'beauty', 'fitness', 'food', 'travel',
  'tech', 'gaming', 'music', 'comedy', 'education', 'business',
  'art', 'pets', 'family', 'other'
);

-- Platform Enum
CREATE TYPE platform_type AS ENUM ('instagram', 'tiktok');

-- Analysis Status Enum
CREATE TYPE analysis_status AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'rate_limited');

-- ====================================================================
-- USER PROFILES AND SETTINGS (extends Supabase auth.users)
-- ====================================================================

-- User profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User settings table
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email_notifications BOOLEAN DEFAULT TRUE,
  dark_mode BOOLEAN DEFAULT FALSE,
  auto_save BOOLEAN DEFAULT TRUE,
  show_bookmarks BOOLEAN DEFAULT TRUE,
  show_recent_searches BOOLEAN DEFAULT TRUE,
  skip_delete_confirmation BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================
-- CREATOR DISCOVERY SYSTEM
-- ====================================================================

-- CREATORS TABLE - Discovery Pool
-- This table stores unique creators (username + platform combination)
-- Once a creator is analyzed, they become part of the discovery pool
CREATE TABLE creators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(255) NOT NULL,
  platform platform_type NOT NULL,
  
  -- Basic profile info (from most recent analysis)
  display_name VARCHAR(255),
  bio TEXT,
  profile_image_url TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  location VARCHAR(255),
  website_url TEXT,
  
  -- Discovery metadata
  is_discoverable BOOLEAN DEFAULT TRUE, -- Can be shown on discovery page
  discovery_priority INTEGER DEFAULT 0, -- Higher = shown first (trending, popular, etc)
  category creator_category,
  
  -- Timestamps
  first_analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint on username + platform
  UNIQUE(username, platform)
);

-- CREATOR ANALYSES TABLE - Historical Data
-- This table stores every analysis performed on a creator
-- Allows us to track trends and changes over time
CREATE TABLE creator_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  
  -- Analysis metadata
  analysis_status analysis_status DEFAULT 'pending',
  analysis_error TEXT,
  analyzed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Can be NULL for anonymous
  
  -- Core metrics that drive discovery
  follower_count INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,
  
  -- Platform-specific key metrics
  -- Instagram: post_count is critical
  post_count INTEGER, -- NULL for TikTok
  -- TikTok: like_count is critical  
  like_count INTEGER, -- NULL for Instagram
  video_count INTEGER, -- For TikTok, NULL for Instagram
  
  -- Calculated engagement metrics
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  average_likes DECIMAL(10,2) DEFAULT 0,
  average_comments DECIMAL(10,2) DEFAULT 0,
  average_views DECIMAL(10,2) DEFAULT 0, -- TikTok only
  
  -- Profile data snapshot (at time of analysis)
  display_name VARCHAR(255),
  bio TEXT,
  profile_image_url TEXT,
  profile_image_base64 TEXT, -- For offline storage
  is_verified BOOLEAN DEFAULT FALSE,
  location VARCHAR(255),
  website_url TEXT,
  
  -- AI Analysis Results
  ai_analysis_raw JSONB, -- Full OpenAI response
  ai_creator_score VARCHAR(50), -- e.g., "8.2/10"
  ai_category creator_category,
  ai_brand_potential TEXT,
  ai_key_strengths TEXT,
  ai_engagement_quality TEXT,
  ai_content_style TEXT,
  ai_audience_demographics TEXT,
  ai_collaboration_potential TEXT,
  ai_overall_assessment TEXT,
  
  -- Cost and performance tracking
  analysis_cost_cents INTEGER DEFAULT 0,
  analysis_duration_ms INTEGER DEFAULT 0,
  
  -- Data quality metrics
  data_quality_score DECIMAL(5,2) DEFAULT 0,
  data_completeness DECIMAL(5,2) DEFAULT 0,
  
  -- Scraping metadata
  scraping_method VARCHAR(100), -- e.g., "playwright", "api"
  user_agent TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================
-- USER BOOKMARKS AND ACTIVITY
-- ====================================================================

-- User bookmarks table
CREATE TABLE user_bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES creator_analyses(id) ON DELETE SET NULL, -- Which analysis was bookmarked
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure a user can only bookmark a creator once
  UNIQUE(user_id, creator_id)
);

-- User search history table
CREATE TABLE user_search_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  search_query VARCHAR(255) NOT NULL,
  platform platform_type NOT NULL,
  creator_id UUID REFERENCES creators(id) ON DELETE SET NULL,
  analysis_id UUID REFERENCES creator_analyses(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================
-- SYSTEM ANALYTICS AND MONITORING
-- ====================================================================

-- API usage tracking
CREATE TABLE api_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  cost_cents INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rate limiting tracking
CREATE TABLE rate_limit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address INET,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  endpoint VARCHAR(255) NOT NULL,
  requests_count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================
-- VIEWS FOR EFFICIENT QUERYING
-- ====================================================================

-- Discovery View: Latest analysis data for each creator
CREATE VIEW creator_discovery AS
SELECT 
  c.id,
  c.username,
  c.platform,
  c.is_discoverable,
  c.discovery_priority,
  c.first_analyzed_at,
  c.last_analyzed_at,
  
  -- Latest analysis data
  latest.id as latest_analysis_id,
  latest.follower_count,
  latest.following_count,
  latest.post_count,
  latest.like_count,
  latest.video_count,
  latest.engagement_rate,
  latest.display_name,
  latest.bio,
  latest.profile_image_url,
  latest.profile_image_base64,
  latest.is_verified,
  latest.location,
  latest.website_url,
  latest.ai_creator_score,
  latest.ai_category AS category,
  latest.ai_brand_potential,
  latest.ai_key_strengths,
  latest.ai_engagement_quality,
  latest.ai_content_style,
  latest.ai_audience_demographics,
  latest.ai_collaboration_potential,
  latest.ai_overall_assessment,
  latest.data_quality_score,
  latest.created_at as last_analysis_date,
  
  -- Analysis count
  (SELECT COUNT(*) FROM creator_analyses WHERE creator_id = c.id AND analysis_status = 'completed') as total_analyses
FROM creators c
LEFT JOIN LATERAL (
  SELECT *
  FROM creator_analyses ca
  WHERE ca.creator_id = c.id 
    AND ca.analysis_status = 'completed'
  ORDER BY ca.created_at DESC
  LIMIT 1
) latest ON true
WHERE c.is_discoverable = true
  AND latest.id IS NOT NULL; -- Only show creators with at least one successful analysis

-- Trending Creators View: Creators with significant growth
CREATE VIEW trending_creators AS
SELECT 
  cd.*,
  -- Growth calculations (comparing last 2 analyses)
  COALESCE(
    ((cd.follower_count - prev.follower_count) * 100.0 / NULLIF(prev.follower_count, 0)),
    0
  ) AS follower_growth_percent,
  
  COALESCE(
    ((cd.engagement_rate - prev.engagement_rate)),
    0
  ) AS engagement_growth_percent,
  
  -- Time since previous analysis
  EXTRACT(DAYS FROM (cd.last_analysis_date - prev.analysis_date)) AS days_between_analyses
  
FROM creator_discovery cd
LEFT JOIN LATERAL (
  SELECT follower_count, engagement_rate, created_at as analysis_date
  FROM creator_analyses ca
  WHERE ca.creator_id = cd.id 
    AND ca.analysis_status = 'completed'
    AND ca.created_at < cd.last_analysis_date
  ORDER BY ca.created_at DESC
  LIMIT 1
) prev ON true
WHERE cd.follower_count > 1000 -- Minimum threshold
  AND prev.follower_count IS NOT NULL -- Must have previous data
ORDER BY follower_growth_percent DESC;

-- User Bookmarks with Creator Data View
CREATE VIEW user_bookmarks_with_creators AS
SELECT 
  ub.id as bookmark_id,
  ub.user_id,
  ub.notes,
  ub.created_at as bookmarked_at,
  ub.updated_at as bookmark_updated_at,
  
  -- Creator data from discovery view
  cd.*
FROM user_bookmarks ub
JOIN creator_discovery cd ON ub.creator_id = cd.id;

-- Recent Searches with Results View
CREATE VIEW user_recent_searches AS
SELECT 
  ush.id as search_id,
  ush.user_id,
  ush.search_query,
  ush.platform,
  ush.created_at as searched_at,
  
  -- Creator data if found
  cd.id as creator_id,
  cd.username,
  cd.display_name,
  cd.follower_count,
  cd.engagement_rate,
  cd.category,
  cd.ai_creator_score
FROM user_search_history ush
LEFT JOIN creator_discovery cd ON ush.creator_id = cd.id
ORDER BY ush.created_at DESC;

-- ====================================================================
-- INDEXES FOR PERFORMANCE
-- ====================================================================

-- Profile indexes
CREATE INDEX idx_profiles_username ON profiles(username);

-- Creator indexes
CREATE INDEX idx_creators_platform ON creators(platform);
CREATE INDEX idx_creators_username ON creators(username);
CREATE INDEX idx_creators_discoverable ON creators(is_discoverable) WHERE is_discoverable = true;
CREATE INDEX idx_creators_priority_desc ON creators(discovery_priority DESC, last_analyzed_at DESC);
CREATE INDEX idx_creators_last_analyzed ON creators(last_analyzed_at DESC);
CREATE INDEX idx_creators_category ON creators(category) WHERE category IS NOT NULL;

-- Analysis indexes
CREATE INDEX idx_creator_analyses_creator_id ON creator_analyses(creator_id);
CREATE INDEX idx_creator_analyses_status ON creator_analyses(analysis_status);
CREATE INDEX idx_creator_analyses_created_desc ON creator_analyses(created_at DESC);
CREATE INDEX idx_creator_analyses_creator_created ON creator_analyses(creator_id, created_at DESC);
CREATE INDEX idx_creator_analyses_user_id ON creator_analyses(analyzed_by_user_id) WHERE analyzed_by_user_id IS NOT NULL;

-- Metrics indexes for filtering/sorting
CREATE INDEX idx_creator_analyses_followers ON creator_analyses(follower_count DESC) WHERE analysis_status = 'completed';
CREATE INDEX idx_creator_analyses_engagement ON creator_analyses(engagement_rate DESC) WHERE analysis_status = 'completed';
CREATE INDEX idx_creator_analyses_category ON creator_analyses(ai_category) WHERE analysis_status = 'completed';

-- Platform-specific indexes
CREATE INDEX idx_creator_analyses_instagram_posts ON creator_analyses(post_count DESC) WHERE post_count IS NOT NULL;
CREATE INDEX idx_creator_analyses_tiktok_likes ON creator_analyses(like_count DESC) WHERE like_count IS NOT NULL;

-- Bookmark indexes
CREATE INDEX idx_user_bookmarks_user_id ON user_bookmarks(user_id);
CREATE INDEX idx_user_bookmarks_creator_id ON user_bookmarks(creator_id);
CREATE INDEX idx_user_bookmarks_created ON user_bookmarks(created_at DESC);

-- Search history indexes
CREATE INDEX idx_user_search_history_user_id ON user_search_history(user_id);
CREATE INDEX idx_user_search_history_created_at ON user_search_history(created_at DESC);

-- System indexes
CREATE INDEX idx_api_usage_logs_user_id ON api_usage_logs(user_id);
CREATE INDEX idx_api_usage_logs_created ON api_usage_logs(created_at DESC);
CREATE INDEX idx_rate_limit_logs_ip ON rate_limit_logs(ip_address, window_start DESC);

-- ====================================================================
-- FUNCTIONS FOR COMMON OPERATIONS
-- ====================================================================

-- Function to get or create a creator
CREATE OR REPLACE FUNCTION get_or_create_creator(
  p_username VARCHAR(255),
  p_platform platform_type
) RETURNS UUID AS $$
DECLARE
  creator_id UUID;
BEGIN
  -- Try to find existing creator
  SELECT id INTO creator_id
  FROM creators
  WHERE username = p_username AND platform = p_platform;
  
  -- Create if doesn't exist
  IF creator_id IS NULL THEN
    INSERT INTO creators (username, platform)
    VALUES (p_username, p_platform)
    RETURNING id INTO creator_id;
  END IF;
  
  RETURN creator_id;
END;
$$ LANGUAGE plpgsql;

-- Function to start a new analysis
CREATE OR REPLACE FUNCTION start_creator_analysis(
  p_username VARCHAR(255),
  p_platform platform_type,
  p_user_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  creator_id UUID;
  analysis_id UUID;
BEGIN
  -- Get or create creator
  creator_id := get_or_create_creator(p_username, p_platform);
  
  -- Create new analysis record
  INSERT INTO creator_analyses (creator_id, analysis_status, analyzed_by_user_id)
  VALUES (creator_id, 'pending', p_user_id)
  RETURNING id INTO analysis_id;
  
  RETURN analysis_id;
END;
$$ LANGUAGE plpgsql;

-- Function to complete an analysis and update creator record
CREATE OR REPLACE FUNCTION complete_creator_analysis(
  p_analysis_id UUID,
  p_data JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  creator_id UUID;
BEGIN
  -- Update the analysis record
  UPDATE creator_analyses 
  SET 
    analysis_status = 'completed',
    follower_count = (p_data->>'follower_count')::INTEGER,
    following_count = (p_data->>'following_count')::INTEGER,
    post_count = CASE WHEN p_data ? 'post_count' THEN (p_data->>'post_count')::INTEGER ELSE NULL END,
    like_count = CASE WHEN p_data ? 'like_count' THEN (p_data->>'like_count')::INTEGER ELSE NULL END,
    video_count = CASE WHEN p_data ? 'video_count' THEN (p_data->>'video_count')::INTEGER ELSE NULL END,
    engagement_rate = COALESCE((p_data->>'engagement_rate')::DECIMAL(5,2), 0),
    average_likes = COALESCE((p_data->>'average_likes')::DECIMAL(10,2), 0),
    average_comments = COALESCE((p_data->>'average_comments')::DECIMAL(10,2), 0),
    average_views = COALESCE((p_data->>'average_views')::DECIMAL(10,2), 0),
    display_name = p_data->>'display_name',
    bio = p_data->>'bio',
    profile_image_url = p_data->>'profile_image_url',
    profile_image_base64 = p_data->>'profile_image_base64',
    is_verified = COALESCE((p_data->>'is_verified')::BOOLEAN, FALSE),
    location = p_data->>'location',
    website_url = p_data->>'website_url',
    ai_analysis_raw = p_data->'ai_analysis',
    ai_creator_score = p_data->>'ai_creator_score',
    ai_category = CASE WHEN p_data ? 'ai_category' THEN (p_data->>'ai_category')::creator_category ELSE NULL END,
    ai_brand_potential = p_data->>'ai_brand_potential',
    ai_key_strengths = p_data->>'ai_key_strengths',
    ai_engagement_quality = p_data->>'ai_engagement_quality',
    ai_content_style = p_data->>'ai_content_style',
    ai_audience_demographics = p_data->>'ai_audience_demographics',
    ai_collaboration_potential = p_data->>'ai_collaboration_potential',
    ai_overall_assessment = p_data->>'ai_overall_assessment',
    analysis_cost_cents = COALESCE((p_data->>'analysis_cost_cents')::INTEGER, 0),
    analysis_duration_ms = COALESCE((p_data->>'analysis_duration_ms')::INTEGER, 0),
    data_quality_score = COALESCE((p_data->>'data_quality_score')::DECIMAL(5,2), 0),
    data_completeness = COALESCE((p_data->>'data_completeness')::DECIMAL(5,2), 0),
    scraping_method = p_data->>'scraping_method',
    user_agent = p_data->>'user_agent'
  WHERE id = p_analysis_id
  RETURNING creator_id INTO creator_id;
  
  -- Update creator's latest analysis timestamp and basic info
  UPDATE creators 
  SET 
    last_analyzed_at = NOW(),
    updated_at = NOW(),
    display_name = p_data->>'display_name',
    bio = p_data->>'bio',
    profile_image_url = p_data->>'profile_image_url',
    is_verified = COALESCE((p_data->>'is_verified')::BOOLEAN, FALSE),
    location = p_data->>'location',
    website_url = p_data->>'website_url',
    category = CASE WHEN p_data ? 'ai_category' THEN (p_data->>'ai_category')::creator_category ELSE category END
  WHERE id = creator_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to add creator to user's search history
CREATE OR REPLACE FUNCTION log_user_search(
  p_user_id UUID,
  p_search_query VARCHAR(255),
  p_platform platform_type,
  p_creator_id UUID DEFAULT NULL,
  p_analysis_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  search_id UUID;
BEGIN
  INSERT INTO user_search_history (user_id, search_query, platform, creator_id, analysis_id)
  VALUES (p_user_id, p_search_query, p_platform, p_creator_id, p_analysis_id)
  RETURNING id INTO search_id;
  
  RETURN search_id;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

-- Enable RLS on all user tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- User bookmarks policies
CREATE POLICY "Users can view their own bookmarks" ON user_bookmarks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bookmarks" ON user_bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bookmarks" ON user_bookmarks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookmarks" ON user_bookmarks
  FOR DELETE USING (auth.uid() = user_id);

-- User search history policies
CREATE POLICY "Users can view their own search history" ON user_search_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own search history" ON user_search_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own search history" ON user_search_history
  FOR DELETE USING (auth.uid() = user_id);

-- User settings policies
CREATE POLICY "Users can view their own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Creator and analysis tables are publicly readable for discovery
-- But only authenticated users can create analyses
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view creators" ON creators
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view completed analyses" ON creator_analyses
  FOR SELECT USING (analysis_status = 'completed');

CREATE POLICY "Service role can manage creators" ON creators
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage analyses" ON creator_analyses
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ====================================================================
-- TRIGGERS
-- ====================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_creators_updated_at 
  BEFORE UPDATE ON creators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_bookmarks_updated_at 
  BEFORE UPDATE ON user_bookmarks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at 
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically create profile and settings when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply the new user trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- SAMPLE DATA FOR TESTING (OPTIONAL)
-- ====================================================================

-- Insert some sample creators (uncomment to use)
/*
INSERT INTO creators (username, platform, display_name, bio, is_verified, category) VALUES
('fitness_guru', 'instagram', 'Fitness Guru', 'Your daily dose of fitness motivation', true, 'fitness'),
('foodie_travels', 'instagram', 'Foodie Travels', 'Exploring the world one bite at a time', false, 'food'),
('tech_reviewer', 'tiktok', 'Tech Reviewer', 'Latest tech reviews and unboxings', true, 'tech'),
('comedy_central', 'tiktok', 'Comedy Central', 'Making you laugh daily', false, 'comedy');

-- Insert sample analyses
INSERT INTO creator_analyses (creator_id, analysis_status, follower_count, following_count, post_count, engagement_rate, ai_creator_score, ai_category) 
SELECT 
  id, 
  'completed', 
  FLOOR(RANDOM() * 100000 + 10000)::INTEGER,
  FLOOR(RANDOM() * 5000 + 500)::INTEGER,
  CASE WHEN platform = 'instagram' THEN FLOOR(RANDOM() * 500 + 50)::INTEGER ELSE NULL END,
  ROUND((RANDOM() * 10)::NUMERIC, 2),
  ROUND((RANDOM() * 3 + 7)::NUMERIC, 1) || '/10',
  category
FROM creators;
*/

-- ====================================================================
-- HELPFUL QUERIES FOR THE APPLICATION
-- ====================================================================

/*
-- Get paginated creators for discovery page
SELECT * FROM creator_discovery
WHERE platform = 'instagram' -- optional filter
  AND category = 'fitness' -- optional filter
  AND follower_count BETWEEN 10000 AND 100000 -- optional range
ORDER BY discovery_priority DESC, follower_count DESC
LIMIT 20 OFFSET 0;

-- Get trending creators
SELECT * FROM trending_creators
WHERE follower_growth_percent > 5
LIMIT 20;

-- Search creators
SELECT * FROM creator_discovery
WHERE (username ILIKE '%search%' OR display_name ILIKE '%search%')
ORDER BY follower_count DESC
LIMIT 20;

-- Get user's bookmarks
SELECT * FROM user_bookmarks_with_creators
WHERE user_id = 'user-uuid'
ORDER BY bookmarked_at DESC;

-- Get user's recent searches
SELECT * FROM user_recent_searches
WHERE user_id = 'user-uuid'
LIMIT 10;

-- Get analysis history for trends
SELECT 
  follower_count,
  engagement_rate,
  ai_creator_score,
  created_at
FROM creator_analyses
WHERE creator_id = 'creator-uuid' 
  AND analysis_status = 'completed'
ORDER BY created_at DESC
LIMIT 10;

-- Start new analysis
SELECT start_creator_analysis('username', 'instagram', 'user-uuid');

-- Complete analysis
SELECT complete_creator_analysis('analysis-uuid', '{"follower_count": 10000, "following_count": 500, ...}'::jsonb);
*/