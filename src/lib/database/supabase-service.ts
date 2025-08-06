import { createServerClient } from '@/lib/supabase';

interface CreatorAnalysisData {
  // Basic profile info (matches API response structure)
  profile: {
    username: string;
    platform: 'instagram' | 'tiktok';
    displayName: string;
    bio?: string;
    profileImageUrl?: string;
    profileImageBase64?: string;
    isVerified: boolean;
    followerCount: number;
    followingCount: number;
    location?: string;
    website?: string;
    metrics: {
      followerCount?: number;
      followingCount?: number;
      postCount?: number; // Instagram
      likeCount?: number; // TikTok
      videoCount?: number; // TikTok
      engagementRate?: number;
      averageLikes?: number;
      averageComments?: number;
      averageViews?: number; // TikTok
    };
    aiAnalysis?: {
      creator_score: string;
      category: string;
      brand_potential: string;
      key_strengths: string;
      engagement_quality: string;
      content_style: string;
      audience_demographics: string;
      collaboration_potential: string;
      overall_assessment: string;
    };
  };
  scrapingDetails: {
    method: string;
    timestamp: string;
  };
  aiMetrics?: {
    model: string;
    cost: number;
    cached: boolean;
  };
  dataQuality?: {
    score: number;
    isValid: boolean;
    breakdown: {
      completeness: number;
      consistency: number;
      reliability: number;
    };
    issues?: Array<{
      field: string;
      message: string;
      severity: 'critical' | 'warning' | 'info';
    }>;
    transformations?: number;
  };
  processingTime?: number;
}

/**
 * Save complete creator analysis to Supabase using our database functions
 */
export async function saveCreatorAnalysis(
  analysisData: CreatorAnalysisData,
  userId?: string
): Promise<{ success: boolean; analysisId?: string; error?: string }> {
  try {
    const supabase = createServerClient();
    
    console.log('🚀 Starting analysis record for:', analysisData.profile.username, analysisData.profile.platform);
    
    // Always use direct table operations for more reliable saving
    // (RPC functions can be complex and prone to JSON/type issues)
    console.log('💾 Using direct table operations for reliable data saving...');
    
    // Direct table operations
    // First, insert or update the creator record (basic info only)
    const { data: creator, error: creatorError } = await supabase
        .from('creators')
        .upsert({
          username: analysisData.profile.username,
          platform: analysisData.profile.platform,
          display_name: analysisData.profile.displayName,
          bio: analysisData.profile.bio,
          profile_image_url: analysisData.profile.profileImageUrl,
          is_verified: analysisData.profile.isVerified,
          location: analysisData.profile.location,
          website: analysisData.profile.website,
          category: analysisData.profile.aiAnalysis?.category,
          last_analyzed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'username,platform'
        })
        .select('id')
        .single();

    if (creatorError) {
      console.error('❌ Error upserting creator:', creatorError);
      return { success: false, error: creatorError.message };
    }

    console.log('✅ Creator record saved with ID:', creator.id);

    // Now insert the detailed analysis record
    const analysisRecord = {
        creator_id: creator.id,
        analysis_status: 'completed',
        analyzed_by_user_id: userId || null,
        
        // Core metrics from scraper
        follower_count: analysisData.profile.followerCount || 0,
        following_count: analysisData.profile.followingCount || 0,
        
        // Platform-specific metrics
        ...(analysisData.profile.platform === 'instagram' && {
          post_count: analysisData.profile.metrics?.postCount,
          average_likes: analysisData.profile.metrics?.averageLikes,
          average_comments: analysisData.profile.metrics?.averageComments,
          engagement_rate: analysisData.profile.metrics?.engagementRate
        }),
        ...(analysisData.profile.platform === 'tiktok' && {
          like_count: analysisData.profile.metrics?.likeCount,
          video_count: analysisData.profile.metrics?.videoCount,
          average_views: analysisData.profile.metrics?.averageViews,
          engagement_rate: analysisData.profile.metrics?.engagementRate
        }),
        
        // Profile snapshot
        display_name: analysisData.profile.displayName,
        bio: analysisData.profile.bio,
        profile_image_url: analysisData.profile.profileImageUrl,
        profile_image_base64: analysisData.profile.profileImageBase64,
        is_verified: analysisData.profile.isVerified,
        location: analysisData.profile.location,
        website: analysisData.profile.website,
        
        // AI analysis results
        ai_analysis_raw: analysisData.profile.aiAnalysis,
        ai_creator_score: analysisData.profile.aiAnalysis?.creator_score,
        ai_category: analysisData.profile.aiAnalysis?.category,
        ai_brand_potential: analysisData.profile.aiAnalysis?.brand_potential,
        ai_key_strengths: analysisData.profile.aiAnalysis?.key_strengths,
        ai_engagement_quality: analysisData.profile.aiAnalysis?.engagement_quality,
        ai_content_style: analysisData.profile.aiAnalysis?.content_style,
        ai_audience_demographics: analysisData.profile.aiAnalysis?.audience_demographics,
        ai_collaboration_potential: analysisData.profile.aiAnalysis?.collaboration_potential,
        ai_overall_assessment: analysisData.profile.aiAnalysis?.overall_assessment,
        
        // AI metrics
        ai_model: analysisData.aiMetrics?.model || 'unknown',
        ai_cost_cents: Math.round((analysisData.aiMetrics?.cost || 0) * 100),
        ai_cached: analysisData.aiMetrics?.cached || false,
        
        // Data quality
        data_quality_score: analysisData.dataQuality?.score || 0,
        data_quality_valid: analysisData.dataQuality?.isValid || true,
        data_completeness: analysisData.dataQuality?.breakdown?.completeness || 0,
        data_consistency: analysisData.dataQuality?.breakdown?.consistency || 0,
        data_reliability: analysisData.dataQuality?.breakdown?.reliability || 0,
        data_transformations: analysisData.dataQuality?.transformations || 0,
        data_issues: analysisData.dataQuality?.issues?.length || 0,
        
        // Scraping metadata
        scraping_method: analysisData.scrapingDetails?.method || 'playwright',
        processing_time_ms: analysisData.processingTime || 0
      };

      const { data: analysis, error: analysisError } = await supabase
        .from('creator_analyses')
        .insert(analysisRecord)
        .select('id')
        .single();

      if (analysisError) {
        console.error('❌ Error inserting analysis record:', analysisError);
        // Don't fail completely - creator record was still saved
        console.warn('⚠️ Continuing despite analysis record error');
      } else {
        console.log('✅ Analysis record saved with ID:', analysis.id);
      }

      // Insert platform-specific metrics (legacy support)
      if (analysisData.profile.platform === 'instagram' && analysisData.profile.metrics) {
        const { error: metricsError } = await supabase
          .from('instagram_metrics')
          .upsert({
            creator_id: creator.id,
            follower_count: analysisData.profile.metrics.followerCount || 0,
            following_count: analysisData.profile.metrics.followingCount || 0,
            post_count: analysisData.profile.metrics.postCount || 0,
            engagement_rate: analysisData.profile.metrics.engagementRate || 0,
            average_likes: analysisData.profile.metrics.averageLikes || 0,
            average_comments: analysisData.profile.metrics.averageComments || 0,
            updated_at: new Date().toISOString()
          }, { onConflict: 'creator_id' });

        if (metricsError) {
          console.warn('⚠️ Error saving Instagram metrics:', metricsError);
        } else {
          console.log('✅ Instagram metrics saved');
        }
      }

      if (analysisData.profile.platform === 'tiktok' && analysisData.profile.metrics) {
        const { error: metricsError } = await supabase
          .from('tiktok_metrics')
          .upsert({
            creator_id: creator.id,
            follower_count: analysisData.profile.metrics.followerCount || 0,
            following_count: analysisData.profile.metrics.followingCount || 0,
            like_count: analysisData.profile.metrics.likeCount || 0,
            video_count: analysisData.profile.metrics.videoCount || 0,
            average_views: analysisData.profile.metrics.averageViews || 0,
            average_likes: analysisData.profile.metrics.averageLikes || 0,
            updated_at: new Date().toISOString()
          }, { onConflict: 'creator_id' });

        if (metricsError) {
          console.warn('⚠️ Error saving TikTok metrics:', metricsError);
        } else {
          console.log('✅ TikTok metrics saved');
        }
      }
      
    console.log('✅ Analysis saved successfully via direct table operations');
    return { success: true, analysisId: creator.id };

  } catch (error) {
    console.error('💥 Error saving creator analysis:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Log user search in Supabase
 */
export async function logUserSearch(
  userId: string,
  searchQuery: string,
  platform: 'instagram' | 'tiktok',
  creatorId?: string,
  analysisId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServerClient();
    
    const { error } = await supabase
      .rpc('log_user_search', {
        p_user_id: userId,
        p_search_query: searchQuery,
        p_platform: platform,
        p_creator_id: creatorId || null,
        p_analysis_id: analysisId || null
      });

    if (error) {
      console.error('Error logging search:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Database error' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error logging user search:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Get creators for discovery page
 */
export async function getDiscoveryCreators(
  filters?: {
    platform?: 'instagram' | 'tiktok';
    category?: string;
    minFollowers?: number;
    maxFollowers?: number;
    search?: string;
  },
  pagination?: {
    limit?: number;
    offset?: number;
  }
): Promise<{ success: boolean; creators?: Array<Record<string, unknown>>; error?: string }> {
  try {
    const supabase = createServerClient();
    
    let query = supabase
      .from('creator_discovery')
      .select('*');

    // Apply filters
    if (filters?.platform) {
      query = query.eq('platform', filters.platform);
    }
    
    if (filters?.category) {
      query = query.eq('category', filters.category);
    }
    
    if (filters?.minFollowers) {
      query = query.gte('follower_count', filters.minFollowers);
    }
    
    if (filters?.maxFollowers) {
      query = query.lte('follower_count', filters.maxFollowers);
    }
    
    if (filters?.search) {
      query = query.or(`username.ilike.%${filters.search}%,display_name.ilike.%${filters.search}%`);
    }

    // Apply sorting and pagination
    query = query
      .order('discovery_priority', { ascending: false })
      .order('follower_count', { ascending: false });
      
    if (pagination?.limit) {
      query = query.limit(pagination.limit);
    }
    
    if (pagination?.offset) {
      query = query.range(pagination.offset, pagination.offset + (pagination.limit || 20) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching discovery creators:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Database error' };
    }

    return { success: true, creators: data || [] };
  } catch (error) {
    console.error('Error getting discovery creators:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Get trending creators
 */
export async function getTrendingCreators(
  limit: number = 20
): Promise<{ success: boolean; creators?: Array<Record<string, unknown>>; error?: string }> {
  try {
    const supabase = createServerClient();
    
    const { data, error } = await supabase
      .from('trending_creators')
      .select('*')
      .gte('follower_growth_percent', 5) // 5% minimum growth
      .order('follower_growth_percent', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching trending creators:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Database error' };
    }

    return { success: true, creators: data || [] };
  } catch (error) {
    console.error('Error getting trending creators:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}