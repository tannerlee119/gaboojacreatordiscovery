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
    
    // Try RPC first, but fallback to direct table operations if RPC functions don't exist
    try {
      const { data: analysisId, error: startError } = await supabase
        .rpc('start_creator_analysis', {
          p_username: analysisData.profile.username,
          p_platform: analysisData.profile.platform,
          p_user_id: userId || null
        });

      if (startError) {
        throw new Error(`RPC start_creator_analysis failed: ${startError.message}`);
      }
      
      console.log('✅ Analysis started with ID:', analysisId);

      // Prepare data for completion function
      const completionData = {
        profile: {
          username: analysisData.profile.username,
          platform: analysisData.profile.platform,
          displayName: analysisData.profile.displayName,
          bio: analysisData.profile.bio,
          profileImageUrl: analysisData.profile.profileImageUrl,
          profileImageBase64: analysisData.profile.profileImageBase64,
          isVerified: analysisData.profile.isVerified,
          followerCount: analysisData.profile.followerCount,
          followingCount: analysisData.profile.followingCount,
          location: analysisData.profile.location,
          website: analysisData.profile.website,
          metrics: analysisData.profile.metrics,
          aiAnalysis: analysisData.profile.aiAnalysis
        },
        scrapingDetails: analysisData.scrapingDetails,
        aiMetrics: analysisData.aiMetrics || { model: 'none', cost: 0, cached: false },
        dataQuality: analysisData.dataQuality || { 
          score: 100, 
          isValid: true, 
          breakdown: { completeness: 100, consistency: 100, reliability: 100 }
        },
        processingTime: analysisData.processingTime || 0
      };

      console.log('🔄 Completing analysis with ID:', analysisId);
      
      const { error: completeError } = await supabase
        .rpc('complete_creator_analysis', {
          p_analysis_id: analysisId,
          p_data: completionData
        });

      if (completeError) {
        throw new Error(`RPC complete_creator_analysis failed: ${completeError.message}`);
      }
      
      console.log('✅ Analysis completed successfully via RPC');
      return { success: true, analysisId };
      
    } catch (rpcError) {
      console.warn('⚠️ RPC functions failed, falling back to direct table operations:', rpcError);
      
      // Fallback: Direct table operations
      // First, insert or update the creator record
      const { data: creator, error: creatorError } = await supabase
        .from('creators')
        .upsert({
          username: analysisData.profile.username,
          platform: analysisData.profile.platform,
          display_name: analysisData.profile.displayName,
          bio: analysisData.profile.bio,
          profile_image_url: analysisData.profile.profileImageUrl,
          is_verified: analysisData.profile.isVerified,
          follower_count: analysisData.profile.followerCount,
          following_count: analysisData.profile.followingCount,
          location: analysisData.profile.location,
          website: analysisData.profile.website,
          analysis_status: 'completed',
          last_analyzed: new Date().toISOString(),
          // AI Analysis fields
          creator_score: analysisData.profile.aiAnalysis?.creator_score,
          category: analysisData.profile.aiAnalysis?.category,
          brand_potential: analysisData.profile.aiAnalysis?.brand_potential,
          key_strengths: analysisData.profile.aiAnalysis?.key_strengths,
          engagement_quality: analysisData.profile.aiAnalysis?.engagement_quality,
          content_style: analysisData.profile.aiAnalysis?.content_style,
          audience_demographics: analysisData.profile.aiAnalysis?.audience_demographics,
          collaboration_potential: analysisData.profile.aiAnalysis?.collaboration_potential,
          overall_assessment: analysisData.profile.aiAnalysis?.overall_assessment
        }, { 
          onConflict: 'username,platform',
          returning: 'representation'
        })
        .select('id')
        .single();

      if (creatorError) {
        console.error('❌ Error upserting creator:', creatorError);
        return { success: false, error: creatorError.message };
      }

      console.log('✅ Creator record saved with ID:', creator.id);

      // Insert platform-specific metrics
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
    }

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
      return { success: false, error: error.message };
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
      return { success: false, error: error.message };
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
      return { success: false, error: error.message };
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