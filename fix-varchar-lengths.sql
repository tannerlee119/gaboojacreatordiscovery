-- Fix VARCHAR length issues causing "value too long" errors
-- Increase VARCHAR(50) fields that might exceed 50 characters

-- Drop views that depend on these columns
DROP VIEW IF EXISTS user_bookmarks_with_creators CASCADE;
DROP VIEW IF EXISTS creator_discovery CASCADE;
DROP VIEW IF EXISTS trending_creators CASCADE;
DROP VIEW IF EXISTS user_recent_searches CASCADE;

-- Update column lengths in creator_analyses table
ALTER TABLE creator_analyses 
ALTER COLUMN ai_creator_score TYPE VARCHAR(200),  -- AI scores can be descriptive
ALTER COLUMN ai_model TYPE VARCHAR(100);          -- Model names can be long

-- Update column lengths in api_usage_logs table  
ALTER TABLE api_usage_logs
ALTER COLUMN ai_model TYPE VARCHAR(100);          -- Model names can be long

-- Recreate the views (same as before)
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
  latest.website,
  
  -- AI Analysis
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
  AND latest.id IS NOT NULL;

-- Trending Creators View
CREATE VIEW trending_creators AS
SELECT 
  cd.*,
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
WHERE cd.follower_count >= 1000
  AND prev.follower_count IS NOT NULL
ORDER BY follower_growth_percent DESC;

-- User Bookmarks with Creator Data
CREATE VIEW user_bookmarks_with_creators AS
SELECT 
  ub.id as bookmark_id,
  ub.user_id,
  ub.comments,
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