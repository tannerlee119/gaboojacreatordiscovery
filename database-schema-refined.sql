-- ====================================================================
-- GABOOJA CREATOR DISCOVERY - REFINED DATABASE SCHEMA
-- ====================================================================
-- This schema perfectly matches our actual analysis pipeline data structure
-- Based on real scraper outputs and API response formats
-- Run this as a complete replacement for all previous schema files

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- ENUMS AND TYPES
-- ====================================================================

-- Creator Categories (matches AI analysis categories)
CREATE TYPE creator_category AS ENUM (
  'lifestyle', 'fashion', 'beauty', 'fitness', 'food', 'travel',
  'tech', 'gaming', 'music', 'comedy', 'education', 'business',
  'art', 'pets', 'family', 'other'
);

-- Platform Enum (matches our supported platforms)
CREATE TYPE platform_type AS ENUM ('instagram', 'tiktok');

-- Analysis Status Enum (matches our processing pipeline)
CREATE TYPE analysis_status AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'rate_limited');

-- Data Quality Severity (matches our validation system)
CREATE TYPE severity_level AS ENUM ('critical', 'warning', 'info');

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

-- User settings table (matches our settings interface)
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
-- Stores unique creators (username + platform combination)
-- Once analyzed, they become part of the discovery pool
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
  website TEXT, -- Note: called 'website' not 'website_url' in our scrapers
  
  -- Discovery metadata
  is_discoverable BOOLEAN DEFAULT TRUE,
  discovery_priority INTEGER DEFAULT 0, -- For trending/featured creators
  category creator_category, -- From AI analysis
  
  -- Timestamps
  first_analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint on username + platform
  UNIQUE(username, platform)
);

-- CREATOR ANALYSES TABLE - Complete Historical Data
-- Every analysis is stored separately for trend tracking
-- Matches the exact structure returned by /api/analyze-creator
CREATE TABLE creator_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  
  -- Analysis metadata
  analysis_status analysis_status DEFAULT 'pending',
  analysis_error TEXT,
  analyzed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- CORE METRICS (scraped data) - exactly matches our scrapers
  follower_count INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,
  
  -- Platform-specific metrics (exactly matches our InstagramMetrics/TikTokMetrics)
  -- Instagram metrics
  post_count INTEGER, -- Instagram only
  average_likes DECIMAL(10,2), -- Instagram: averageLikes
  average_comments DECIMAL(10,2), -- Instagram: averageComments
  engagement_rate DECIMAL(5,2) DEFAULT 0, -- Both platforms
  
  -- TikTok metrics  
  like_count INTEGER, -- TikTok: likeCount (total profile likes)
  video_count INTEGER, -- TikTok: videoCount
  average_views DECIMAL(10,2), -- TikTok: averageViews
  
  -- Profile data snapshot (exactly matches scraper output)
  display_name VARCHAR(255),
  bio TEXT,
  profile_image_url TEXT,
  profile_image_base64 TEXT, -- Screenshot stored as base64
  is_verified BOOLEAN DEFAULT FALSE,
  location VARCHAR(255),
  website TEXT, -- Not website_url - matches scraper field name
  
  -- AI ANALYSIS RESULTS (exactly matches OpenAI analyzer output)
  ai_analysis_raw JSONB, -- Full OpenAI response for future use
  ai_creator_score VARCHAR(50), -- e.g., "8.2/10" - exact format from AI
  ai_category creator_category, -- Maps to our enum
  ai_brand_potential TEXT, -- brand_potential from AI
  ai_key_strengths TEXT, -- key_strengths from AI  
  ai_engagement_quality TEXT, -- engagement_quality from AI
  ai_content_style TEXT, -- content_style from AI
  ai_audience_demographics TEXT, -- audience_demographics from AI
  ai_collaboration_potential TEXT, -- collaboration_potential from AI
  ai_overall_assessment TEXT, -- overall_assessment from AI
  
  -- AI METRICS (matches aiMetrics in response)
  ai_model VARCHAR(50), -- e.g., "gpt-4o", "gpt-4o-mini", "cached"
  ai_cost_cents INTEGER DEFAULT 0, -- Cost in cents (matches cost tracking)
  ai_cached BOOLEAN DEFAULT FALSE, -- Was result from cache
  
  -- DATA QUALITY (matches dataQuality in response)
  data_quality_score DECIMAL(5,2) DEFAULT 0, -- Overall quality score 0-100
  data_quality_valid BOOLEAN DEFAULT TRUE, -- Is data valid
  data_completeness DECIMAL(5,2) DEFAULT 0, -- Completeness score
  data_consistency DECIMAL(5,2) DEFAULT 0, -- Consistency score  
  data_reliability DECIMAL(5,2) DEFAULT 0, -- Reliability score
  data_transformations INTEGER DEFAULT 0, -- Number of transformations applied
  data_issues INTEGER DEFAULT 0, -- Number of issues found
  
  -- SCRAPING METADATA (matches scrapingDetails in response)
  scraping_method VARCHAR(100), -- e.g., "playwright", "public-api"
  user_agent TEXT, -- User agent used for scraping
  processing_time_ms INTEGER DEFAULT 0, -- Total processing time
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DATA QUALITY ISSUES - Detailed issue tracking
CREATE TABLE analysis_quality_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_id UUID REFERENCES creator_analyses(id) ON DELETE CASCADE,
  field_name VARCHAR(100) NOT NULL, -- e.g., "followerCount", "bio"
  issue_message TEXT NOT NULL, -- Human readable issue description
  severity severity_level NOT NULL, -- critical, warning, info
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================
-- USER BOOKMARKS AND ACTIVITY
-- ====================================================================

-- User bookmarks (matches our bookmark interface)
CREATE TABLE user_bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES creator_analyses(id) ON DELETE SET NULL, -- Which analysis was bookmarked
  comments TEXT, -- User notes (called 'comments' in our interface)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure a user can only bookmark a creator once
  UNIQUE(user_id, creator_id)
);

-- User search history
CREATE TABLE user_search_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  search_query VARCHAR(255) NOT NULL, -- What user searched for
  platform platform_type NOT NULL,
  creator_id UUID REFERENCES creators(id) ON DELETE SET NULL, -- Found creator (if any)
  analysis_id UUID REFERENCES creator_analyses(id) ON DELETE SET NULL, -- Created analysis (if any)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================
-- SYSTEM MONITORING (matches our response headers and tracking)
-- ====================================================================

-- API usage tracking (matches our cost tracking)
CREATE TABLE api_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER,
  processing_time_ms INTEGER, -- Matches X-Processing-Time header
  ai_cost_cents INTEGER DEFAULT 0, -- Matches X-AI-Cost header
  ai_model VARCHAR(50), -- Matches X-AI-Model header
  ai_cached BOOLEAN DEFAULT FALSE, -- Matches X-AI-Cached header
  data_quality_score DECIMAL(5,2), -- Matches X-Data-Quality-Score header
  data_transformations INTEGER, -- Matches X-Data-Transformations header
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rate limiting tracking (matches our rate limiter)
CREATE TABLE rate_limit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address INET,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  endpoint VARCHAR(255) NOT NULL,
  requests_count INTEGER DEFAULT 1,
  rate_limit_exceeded BOOLEAN DEFAULT FALSE,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================
-- VIEWS FOR DISCOVERY PAGE (optimized for our UI needs)
-- ====================================================================

-- Main Discovery View: Latest analysis data for each creator
-- Matches exactly what DiscoveryCreatorCard component expects
CREATE VIEW creator_discovery AS
SELECT 
  c.id,
  c.username,
  c.platform,
  c.is_discoverable,
  c.discovery_priority,
  c.first_analyzed_at,
  c.last_analyzed_at,
  
  -- Latest analysis data (matches DiscoveryCreator interface)
  latest.id as latest_analysis_id,
  latest.follower_count,
  latest.following_count,
  latest.post_count, -- Instagram
  latest.like_count, -- TikTok  
  latest.video_count, -- TikTok
  latest.engagement_rate,
  latest.display_name,
  latest.bio,
  latest.profile_image_url,
  latest.profile_image_base64,
  latest.is_verified,
  latest.location,
  latest.website,
  
  -- AI Analysis (for filtering and display)
  latest.ai_creator_score,
  latest.ai_category AS category,
  latest.ai_brand_potential,
  latest.ai_key_strengths,
  latest.ai_engagement_quality,
  latest.ai_content_style,
  latest.ai_audience_demographics,
  latest.ai_collaboration_potential,
  latest.ai_overall_assessment,
  
  -- Quality and metadata
  latest.data_quality_score,
  latest.data_quality_valid,
  latest.created_at as last_analysis_date,
  
  -- Analysis count for trending calculation
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
  AND latest.id IS NOT NULL; -- Only show creators with successful analysis

-- Trending Creators View: Growth calculations
CREATE VIEW trending_creators AS
SELECT 
  cd.*,
  -- Growth calculations (comparing last 2 analyses)
  COALESCE(
    CASE 
      WHEN prev.follower_count > 0 THEN
        ((cd.follower_count - prev.follower_count) * 100.0 / prev.follower_count)
      ELSE 0
    END,
    0
  ) AS follower_growth_percent,
  
  COALESCE(
    (cd.engagement_rate - prev.engagement_rate),
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
WHERE cd.follower_count >= 1000 -- Minimum threshold for trending
  AND prev.follower_count IS NOT NULL -- Must have previous data
ORDER BY follower_growth_percent DESC;

-- User Bookmarks with Creator Data (matches our bookmark interface)
CREATE VIEW user_bookmarks_with_creators AS
SELECT 
  ub.id as bookmark_id,
  ub.user_id,
  ub.comments, -- Called 'comments' not 'notes' in our interface
  ub.created_at as bookmarked_at,
  ub.updated_at as bookmark_updated_at,
  
  -- Creator data from discovery view
  cd.id as creator_id,
  cd.username,
  cd.platform,
  cd.display_name,
  cd.bio,
  cd.profile_image_url,
  cd.profile_image_base64,
  cd.is_verified,
  cd.follower_count,
  cd.following_count,
  cd.location,
  cd.website,
  cd.engagement_rate,
  cd.category,
  cd.ai_creator_score,
  cd.ai_brand_potential,
  cd.ai_key_strengths,
  cd.last_analysis_date
FROM user_bookmarks ub
JOIN creator_discovery cd ON ub.creator_id = cd.id;

-- Recent Searches with Results
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
-- INDEXES FOR OPTIMAL DISCOVERY PAGE PERFORMANCE
-- ====================================================================

-- Profile indexes
CREATE INDEX idx_profiles_username ON profiles(username);

-- Creator discovery indexes (optimized for filtering/sorting)
CREATE INDEX idx_creators_platform ON creators(platform);
CREATE INDEX idx_creators_username ON creators(username);
CREATE INDEX idx_creators_discoverable ON creators(is_discoverable) WHERE is_discoverable = true;
CREATE INDEX idx_creators_priority_followers ON creators(discovery_priority DESC, last_analyzed_at DESC);
CREATE INDEX idx_creators_category ON creators(category) WHERE category IS NOT NULL;

-- Analysis indexes (optimized for latest analysis queries)
CREATE INDEX idx_creator_analyses_creator_id ON creator_analyses(creator_id);
CREATE INDEX idx_creator_analyses_status ON creator_analyses(analysis_status);
CREATE INDEX idx_creator_analyses_creator_status_created ON creator_analyses(creator_id, analysis_status, created_at DESC);

-- Discovery page filtering indexes
CREATE INDEX idx_creator_analyses_followers_completed ON creator_analyses(follower_count DESC) WHERE analysis_status = 'completed';
CREATE INDEX idx_creator_analyses_engagement_completed ON creator_analyses(engagement_rate DESC) WHERE analysis_status = 'completed';
CREATE INDEX idx_creator_analyses_category_completed ON creator_analyses(ai_category) WHERE analysis_status = 'completed';

-- Platform-specific metrics indexes
CREATE INDEX idx_creator_analyses_instagram_posts ON creator_analyses(post_count DESC) WHERE post_count IS NOT NULL AND analysis_status = 'completed';
CREATE INDEX idx_creator_analyses_tiktok_likes ON creator_analyses(like_count DESC) WHERE like_count IS NOT NULL AND analysis_status = 'completed';

-- Bookmark indexes
CREATE INDEX idx_user_bookmarks_user_id ON user_bookmarks(user_id);
CREATE INDEX idx_user_bookmarks_created ON user_bookmarks(created_at DESC);

-- Search history indexes  
CREATE INDEX idx_user_search_history_user_id ON user_search_history(user_id);
CREATE INDEX idx_user_search_history_created ON user_search_history(created_at DESC);

-- System monitoring indexes
CREATE INDEX idx_api_usage_logs_created ON api_usage_logs(created_at DESC);
CREATE INDEX idx_rate_limit_logs_ip_window ON rate_limit_logs(ip_address, window_start DESC);

-- Quality issues index
CREATE INDEX idx_analysis_quality_issues_analysis ON analysis_quality_issues(analysis_id);
CREATE INDEX idx_analysis_quality_issues_severity ON analysis_quality_issues(severity);

-- ====================================================================
-- FUNCTIONS FOR ANALYSIS PIPELINE INTEGRATION
-- ====================================================================

-- Function to get or create a creator (matches our current logic)
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

-- Function to start analysis (matches our API workflow)
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

-- Function to complete analysis (matches exact API response structure)
CREATE OR REPLACE FUNCTION complete_creator_analysis(
  p_analysis_id UUID,
  p_data JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  creator_id UUID;
  profile_data JSONB;
  ai_analysis JSONB;
  ai_metrics JSONB;
  data_quality JSONB;
  scraping_details JSONB;
BEGIN
  -- Extract nested JSON objects
  profile_data := p_data->'profile';
  ai_analysis := profile_data->'aiAnalysis';
  ai_metrics := p_data->'aiMetrics';
  data_quality := p_data->'dataQuality';
  scraping_details := p_data->'scrapingDetails';
  
  -- Update the analysis record with exact field mapping
  UPDATE creator_analyses 
  SET 
    analysis_status = 'completed',
    -- Core metrics from profile data
    follower_count = (profile_data->>'followerCount')::INTEGER,
    following_count = (profile_data->>'followingCount')::INTEGER,
    
    -- Platform-specific metrics from profile.metrics
    post_count = CASE WHEN profile_data->'metrics' ? 'postCount' THEN (profile_data->'metrics'->>'postCount')::INTEGER ELSE NULL END,
    like_count = CASE WHEN profile_data->'metrics' ? 'likeCount' THEN (profile_data->'metrics'->>'likeCount')::INTEGER ELSE NULL END,
    video_count = CASE WHEN profile_data->'metrics' ? 'videoCount' THEN (profile_data->'metrics'->>'videoCount')::INTEGER ELSE NULL END,
    engagement_rate = COALESCE((profile_data->'metrics'->>'engagementRate')::DECIMAL(5,2), 0),
    average_likes = COALESCE((profile_data->'metrics'->>'averageLikes')::DECIMAL(10,2), 0),
    average_comments = COALESCE((profile_data->'metrics'->>'averageComments')::DECIMAL(10,2), 0),
    average_views = COALESCE((profile_data->'metrics'->>'averageViews')::DECIMAL(10,2), 0),
    
    -- Profile snapshot
    display_name = profile_data->>'displayName',
    bio = profile_data->>'bio',
    profile_image_url = profile_data->>'profileImageUrl',
    profile_image_base64 = profile_data->>'profileImageBase64',
    is_verified = COALESCE((profile_data->>'isVerified')::BOOLEAN, FALSE),
    location = profile_data->>'location',
    website = profile_data->>'website',
    
    -- AI Analysis results (exact field mapping)
    ai_analysis_raw = ai_analysis,
    ai_creator_score = ai_analysis->>'creator_score',
    ai_category = CASE WHEN ai_analysis ? 'category' THEN (ai_analysis->>'category')::creator_category ELSE NULL END,
    ai_brand_potential = ai_analysis->>'brand_potential',
    ai_key_strengths = ai_analysis->>'key_strengths',
    ai_engagement_quality = ai_analysis->>'engagement_quality',
    ai_content_style = ai_analysis->>'content_style',
    ai_audience_demographics = ai_analysis->>'audience_demographics',
    ai_collaboration_potential = ai_analysis->>'collaboration_potential',
    ai_overall_assessment = ai_analysis->>'overall_assessment',
    
    -- AI Metrics
    ai_model = ai_metrics->>'model',
    ai_cost_cents = COALESCE((ai_metrics->>'cost')::INTEGER, 0),
    ai_cached = COALESCE((ai_metrics->>'cached')::BOOLEAN, FALSE),
    
    -- Data Quality
    data_quality_score = COALESCE((data_quality->>'score')::DECIMAL(5,2), 0),
    data_quality_valid = COALESCE((data_quality->>'isValid')::BOOLEAN, TRUE),
    data_completeness = COALESCE((data_quality->'breakdown'->>'completeness')::DECIMAL(5,2), 0),
    data_consistency = COALESCE((data_quality->'breakdown'->>'consistency')::DECIMAL(5,2), 0),
    data_reliability = COALESCE((data_quality->'breakdown'->>'reliability')::DECIMAL(5,2), 0),
    data_transformations = COALESCE((data_quality->>'transformations')::INTEGER, 0),
    data_issues = CASE 
      WHEN data_quality ? 'issues' AND jsonb_typeof(data_quality->'issues') = 'array' 
      THEN jsonb_array_length(data_quality->'issues') 
      ELSE 0 
    END,
    
    -- Scraping metadata
    scraping_method = scraping_details->>'method',
    processing_time_ms = COALESCE((p_data->>'processingTime')::INTEGER, 0)
    
  WHERE id = p_analysis_id
  RETURNING creator_id INTO creator_id;
  
  -- Update creator's latest info (from most recent analysis)
  UPDATE creators 
  SET 
    last_analyzed_at = NOW(),
    updated_at = NOW(),
    display_name = profile_data->>'displayName',
    bio = profile_data->>'bio',
    profile_image_url = profile_data->>'profileImageUrl',
    is_verified = COALESCE((profile_data->>'isVerified')::BOOLEAN, FALSE),
    location = profile_data->>'location',
    website = profile_data->>'website',
    category = CASE WHEN ai_analysis ? 'category' THEN (ai_analysis->>'category')::creator_category ELSE category END
  WHERE id = creator_id;
  
  -- Insert quality issues if any
  IF data_quality ? 'issues' AND jsonb_typeof(data_quality->'issues') = 'array' THEN
    INSERT INTO analysis_quality_issues (analysis_id, field_name, issue_message, severity)
    SELECT 
      p_analysis_id,
      issue->>'field',
      issue->>'message',
      (issue->>'severity')::severity_level
    FROM jsonb_array_elements(data_quality->'issues') AS issue
    WHERE issue ? 'field' AND issue ? 'message' AND issue ? 'severity';
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to log user search (matches our search tracking)
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

-- Enable RLS on user tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Profile policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Bookmark policies
CREATE POLICY "Users can view their own bookmarks" ON user_bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own bookmarks" ON user_bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own bookmarks" ON user_bookmarks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own bookmarks" ON user_bookmarks FOR DELETE USING (auth.uid() = user_id);

-- Search history policies
CREATE POLICY "Users can view their own search history" ON user_search_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own search history" ON user_search_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own search history" ON user_search_history FOR DELETE USING (auth.uid() = user_id);

-- Settings policies
CREATE POLICY "Users can view their own settings" ON user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own settings" ON user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own settings" ON user_settings FOR UPDATE USING (auth.uid() = user_id);

-- Discovery data is publicly readable
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_quality_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view creators" ON creators FOR SELECT USING (true);
CREATE POLICY "Anyone can view completed analyses" ON creator_analyses FOR SELECT USING (analysis_status = 'completed');
CREATE POLICY "Anyone can view quality issues for completed analyses" ON analysis_quality_issues 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM creator_analyses ca 
      WHERE ca.id = analysis_quality_issues.analysis_id 
      AND ca.analysis_status = 'completed'
    )
  );

-- Service role can manage all data
CREATE POLICY "Service role can manage creators" ON creators FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role can manage analyses" ON creator_analyses FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role can manage quality issues" ON analysis_quality_issues FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

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

CREATE TRIGGER update_creators_updated_at BEFORE UPDATE ON creators FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_bookmarks_updated_at BEFORE UPDATE ON user_bookmarks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to create profile and settings for new users
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- DISCOVERY PAGE QUERIES (ready to use in your API)
-- ====================================================================

/*
-- BASIC DISCOVERY QUERIES

-- Get paginated creators for discovery page
SELECT * FROM creator_discovery
WHERE platform = 'instagram'  -- optional filter
  AND category = 'fitness'     -- optional filter
  AND follower_count BETWEEN 10000 AND 100000  -- optional range
ORDER BY discovery_priority DESC, follower_count DESC
LIMIT 20 OFFSET 0;

-- Get trending creators
SELECT * FROM trending_creators
WHERE follower_growth_percent > 5
LIMIT 20;

-- Search creators by username/name
SELECT * FROM creator_discovery
WHERE (username ILIKE '%search%' OR display_name ILIKE '%search%')
ORDER BY follower_count DESC
LIMIT 20;

-- ANALYSIS WORKFLOW QUERIES

-- Start new analysis (returns analysis_id)
SELECT start_creator_analysis('username', 'instagram', 'user-uuid');

-- Complete analysis with full API response data
SELECT complete_creator_analysis('analysis-uuid', '{"profile": {...}, "aiMetrics": {...}, ...}'::jsonb);

-- USER QUERIES

-- Get user bookmarks
SELECT * FROM user_bookmarks_with_creators
WHERE user_id = 'user-uuid'
ORDER BY bookmarked_at DESC;

-- Get user search history
SELECT * FROM user_recent_searches
WHERE user_id = 'user-uuid'
LIMIT 10;

-- TREND ANALYSIS QUERIES

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
*/