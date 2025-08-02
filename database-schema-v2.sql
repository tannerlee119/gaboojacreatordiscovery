-- Gabooja Creator Discovery Database Schema V2
-- Optimized for Creator Discovery Pool and Trend Analysis
-- Run this instead of the original database-schema.sql

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- ==================================================
-- CREATORS TABLE - Discovery Pool
-- ==================================================
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

-- ==================================================
-- CREATOR ANALYSES TABLE - Historical Data
-- ==================================================
-- This table stores every analysis performed on a creator
-- Allows us to track trends and changes over time
CREATE TABLE creator_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  
  -- Analysis metadata
  analysis_status analysis_status DEFAULT 'pending',
  analysis_error TEXT,
  analyzed_by_user_id UUID, -- References auth.users(id), can be NULL for anonymous
  
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
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================================================
-- VIEWS FOR EASY QUERYING
-- ==================================================

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
  latest.follower_count,
  latest.following_count,
  latest.post_count,
  latest.like_count,
  latest.video_count,
  latest.engagement_rate,
  latest.display_name,
  latest.bio,
  latest.profile_image_url,
  latest.is_verified,
  latest.location,
  latest.website_url,
  latest.ai_creator_score,
  latest.ai_category AS category,
  latest.ai_brand_potential,
  latest.ai_key_strengths,
  latest.created_at as last_analysis_date
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
  ) AS engagement_growth_percent
  
FROM creator_discovery cd
LEFT JOIN LATERAL (
  SELECT follower_count, engagement_rate
  FROM creator_analyses ca
  WHERE ca.creator_id = cd.id 
    AND ca.analysis_status = 'completed'
    AND ca.created_at < (
      SELECT MAX(created_at) 
      FROM creator_analyses 
      WHERE creator_id = cd.id AND analysis_status = 'completed'
    )
  ORDER BY ca.created_at DESC
  LIMIT 1
) prev ON true
WHERE cd.follower_count > 1000 -- Minimum threshold
ORDER BY follower_growth_percent DESC;

-- ==================================================
-- INDEXES FOR PERFORMANCE
-- ==================================================

-- Core discovery indexes
CREATE INDEX idx_creators_platform ON creators(platform);
CREATE INDEX idx_creators_username ON creators(username);
CREATE INDEX idx_creators_discoverable ON creators(is_discoverable) WHERE is_discoverable = true;
CREATE INDEX idx_creators_priority_desc ON creators(discovery_priority DESC, last_analyzed_at DESC);
CREATE INDEX idx_creators_last_analyzed ON creators(last_analyzed_at DESC);

-- Analysis indexes
CREATE INDEX idx_creator_analyses_creator_id ON creator_analyses(creator_id);
CREATE INDEX idx_creator_analyses_status ON creator_analyses(analysis_status);
CREATE INDEX idx_creator_analyses_created_desc ON creator_analyses(created_at DESC);
CREATE INDEX idx_creator_analyses_creator_created ON creator_analyses(creator_id, created_at DESC);

-- Metrics indexes for filtering/sorting
CREATE INDEX idx_creator_analyses_followers ON creator_analyses(follower_count DESC) WHERE analysis_status = 'completed';
CREATE INDEX idx_creator_analyses_engagement ON creator_analyses(engagement_rate DESC) WHERE analysis_status = 'completed';
CREATE INDEX idx_creator_analyses_category ON creator_analyses(ai_category) WHERE analysis_status = 'completed';

-- Platform-specific indexes
CREATE INDEX idx_creator_analyses_instagram_posts ON creator_analyses(post_count DESC) WHERE post_count IS NOT NULL;
CREATE INDEX idx_creator_analyses_tiktok_likes ON creator_analyses(like_count DESC) WHERE like_count IS NOT NULL;

-- User analysis tracking
CREATE INDEX idx_creator_analyses_user ON creator_analyses(analyzed_by_user_id) WHERE analyzed_by_user_id IS NOT NULL;

-- ==================================================
-- FUNCTIONS FOR COMMON OPERATIONS
-- ==================================================

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
    analysis_duration_ms = COALESCE((p_data->>'analysis_duration_ms')::INTEGER, 0)
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

-- ==================================================
-- TRIGGERS
-- ==================================================

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

-- ==================================================
-- SAMPLE QUERIES FOR DISCOVERY PAGE
-- ==================================================

/*
-- Get top creators for discovery (paginated)
SELECT * FROM creator_discovery
WHERE platform = 'instagram' -- optional filter
ORDER BY discovery_priority DESC, follower_count DESC
LIMIT 20 OFFSET 0;

-- Filter by category
SELECT * FROM creator_discovery
WHERE category = 'fitness'
ORDER BY engagement_rate DESC
LIMIT 20;

-- Filter by follower range
SELECT * FROM creator_discovery
WHERE follower_count BETWEEN 10000 AND 100000
ORDER BY engagement_rate DESC
LIMIT 20;

-- Get trending creators
SELECT * FROM trending_creators
WHERE follower_growth_percent > 5 -- 5% growth
LIMIT 20;

-- Search creators by username or display name
SELECT * FROM creator_discovery
WHERE (username ILIKE '%search_term%' OR display_name ILIKE '%search_term%')
ORDER BY follower_count DESC
LIMIT 20;

-- Get analysis history for a creator (for trends)
SELECT 
  follower_count,
  engagement_rate,
  ai_creator_score,
  created_at
FROM creator_analyses
WHERE creator_id = 'some-uuid'
  AND analysis_status = 'completed'
ORDER BY created_at DESC
LIMIT 10;
*/