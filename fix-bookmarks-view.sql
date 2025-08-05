-- Fix user_bookmarks_with_creators view to show all bookmarks
-- The original view only shows bookmarks for creators with completed analyses
-- This updated view shows all bookmarks, even for creators without analyses

-- Drop the existing view
DROP VIEW IF EXISTS user_bookmarks_with_creators;

-- Create updated view that shows all bookmarks
CREATE VIEW user_bookmarks_with_creators AS
SELECT 
  ub.id as bookmark_id,
  ub.user_id,
  ub.comments,
  ub.created_at as bookmarked_at,
  ub.updated_at as bookmark_updated_at,
  
  -- Creator data (from creators table directly, not discovery view)
  c.id as creator_id,
  c.username,
  c.platform,
  
  -- Latest analysis data (if exists)
  COALESCE(latest.display_name, c.display_name) as display_name,
  COALESCE(latest.bio, c.bio) as bio,
  COALESCE(latest.profile_image_url, c.profile_image_url) as profile_image_url,
  latest.profile_image_base64,
  COALESCE(latest.is_verified, c.is_verified, false) as is_verified,
  COALESCE(latest.follower_count, 0) as follower_count,
  COALESCE(latest.following_count, 0) as following_count,
  COALESCE(latest.location, c.location) as location,
  COALESCE(latest.website, c.website) as website,
  latest.engagement_rate,
  latest.ai_category as category,
  latest.ai_creator_score,
  latest.ai_brand_potential,
  latest.ai_key_strengths,
  latest.created_at as last_analysis_date

FROM user_bookmarks ub
JOIN creators c ON ub.creator_id = c.id
LEFT JOIN LATERAL (
  SELECT *
  FROM creator_analyses ca
  WHERE ca.creator_id = c.id 
    AND ca.analysis_status = 'completed'
  ORDER BY ca.created_at DESC
  LIMIT 1
) latest ON true;

-- This view now shows ALL bookmarks:
-- - For creators with analyses: shows latest analysis data
-- - For creators without analyses: shows basic creator data with null/default values