-- Fix issue with large follower counts exceeding INTEGER limits
-- Change follower_count and following_count from INTEGER to BIGINT
-- Note: creators table doesn't have these columns, only creator_analyses does

-- Step 1: Drop views that depend on the columns we want to change
DROP VIEW IF EXISTS user_bookmarks_with_creators CASCADE;
DROP VIEW IF EXISTS creator_discovery CASCADE;
DROP VIEW IF EXISTS trending_creators CASCADE;
DROP VIEW IF EXISTS user_recent_searches CASCADE;

-- Step 2: Update creator_analyses table (detailed analysis records)
ALTER TABLE creator_analyses 
ALTER COLUMN follower_count TYPE BIGINT,
ALTER COLUMN following_count TYPE BIGINT,
ALTER COLUMN post_count TYPE BIGINT,
ALTER COLUMN like_count TYPE BIGINT,
ALTER COLUMN video_count TYPE BIGINT;

-- Update the complete_creator_analysis function to handle BIGINT
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
  
  -- Update the analysis record with exact field mapping using BIGINT
  UPDATE creator_analyses 
  SET 
    analysis_status = 'completed',
    -- Core metrics from profile data (now BIGINT)
    follower_count = (profile_data->>'followerCount')::BIGINT,
    following_count = (profile_data->>'followingCount')::BIGINT,
    
    -- Platform-specific metrics from profile.metrics (now BIGINT)
    post_count = CASE WHEN profile_data->'metrics' ? 'postCount' THEN (profile_data->'metrics'->>'postCount')::BIGINT ELSE NULL END,
    like_count = CASE WHEN profile_data->'metrics' ? 'likeCount' THEN (profile_data->'metrics'->>'likeCount')::BIGINT ELSE NULL END,
    video_count = CASE WHEN profile_data->'metrics' ? 'videoCount' THEN (profile_data->'metrics'->>'videoCount')::BIGINT ELSE NULL END,
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
    
    -- AI metrics
    ai_model = ai_metrics->>'model',
    ai_cost_cents = COALESCE((ai_metrics->>'cost')::INTEGER * 100, 0), -- Convert dollars to cents
    ai_cached = COALESCE((ai_metrics->>'cached')::BOOLEAN, FALSE),
    
    -- Data quality
    data_quality_score = COALESCE((data_quality->>'score')::DECIMAL(5,2), 0),
    data_quality_valid = COALESCE((data_quality->>'isValid')::BOOLEAN, TRUE),
    data_completeness = COALESCE((data_quality->'breakdown'->>'completeness')::DECIMAL(5,2), 0),
    data_consistency = COALESCE((data_quality->'breakdown'->>'consistency')::DECIMAL(5,2), 0),
    data_reliability = COALESCE((data_quality->'breakdown'->>'reliability')::DECIMAL(5,2), 0),
    data_transformations = COALESCE((data_quality->>'transformations')::INTEGER, 0),
    data_issues = 0, -- Would need to count issues array
    
    -- Scraping metadata
    scraping_method = scraping_details->>'method',
    processing_time_ms = COALESCE((p_data->>'processingTime')::INTEGER, 0)
    
  WHERE creator_analyses.id = p_analysis_id
  RETURNING creator_analyses.creator_id INTO creator_id;
  
  -- Update the main creators table with latest data
  UPDATE creators 
  SET 
    display_name = profile_data->>'displayName',
    bio = profile_data->>'bio',
    profile_image_url = profile_data->>'profileImageUrl',
    is_verified = COALESCE((profile_data->>'isVerified')::BOOLEAN, FALSE),
    location = profile_data->>'location',
    website = profile_data->>'website',
    category = CASE WHEN ai_analysis ? 'category' THEN (ai_analysis->>'category')::creator_category ELSE category END,
    last_analyzed_at = NOW(),
    updated_at = NOW()
  WHERE creators.id = creator_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Recreate the views with BIGINT support
-- Main Discovery View: Latest analysis data for each creator
CREATE VIEW creator_discovery AS
SELECT 
  c.id,
  c.username,
  c.platform,
  c.is_discoverable,
  c.discovery_priority,
  c.first_analyzed_at,
  c.last_analyzed_at,
  
  -- Latest analysis data (now BIGINT columns)
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

-- Add comment explaining the change
COMMENT ON COLUMN creator_analyses.follower_count IS 'Follower count at time of analysis - BIGINT for large creators (>2B followers)';
COMMENT ON COLUMN creator_analyses.following_count IS 'Following count at time of analysis - BIGINT for large numbers';
COMMENT ON COLUMN creator_analyses.post_count IS 'Post count - BIGINT for prolific creators';
COMMENT ON COLUMN creator_analyses.like_count IS 'Like count - BIGINT for viral creators';
COMMENT ON COLUMN creator_analyses.video_count IS 'Video count - BIGINT for active creators';