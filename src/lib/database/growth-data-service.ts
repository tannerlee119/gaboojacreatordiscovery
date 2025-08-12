import { createServerClient } from '@/lib/supabase';

export interface GrowthDataPoint {
  timestamp: string;
  followerCount: number;
  analysisId: string;
  growthFromPrevious: number; // Percentage change from previous analysis
  daysSincePrevious: number; // Days between this and previous analysis
}

export interface CreatorGrowthData {
  username: string;
  platform: string;
  displayName: string;
  totalGrowth: {
    percentage: number;
    absolute: number;
    timespan: string; // e.g., "over 15 days"
  };
  dataPoints: GrowthDataPoint[];
}

/**
 * Get complete growth history for a creator
 */
export async function getCreatorGrowthData(
  username: string, 
  platform: 'instagram' | 'tiktok'
): Promise<{ success: boolean; data?: CreatorGrowthData; error?: string }> {
  try {
    const supabase = createServerClient();
    
    console.log(`📈 Fetching growth data for ${platform}/@${username}`);
    
    // First get the creator ID and basic info
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, username, platform, display_name')
      .eq('username', username)
      .eq('platform', platform)
      .single();
    
    if (creatorError) {
      console.error('❌ Creator not found:', creatorError);
      return { success: false, error: 'Creator not found' };
    }
    
    // Get all analyses for this creator ordered by date
    const { data: analyses, error: analysesError } = await supabase
      .from('creator_analyses')
      .select(`
        id,
        follower_count,
        created_at,
        analysis_status
      `)
      .eq('creator_id', creator.id)
      .eq('analysis_status', 'completed')
      .order('created_at', { ascending: true });
    
    if (analysesError) {
      console.error('❌ Error fetching analyses:', analysesError);
      return { success: false, error: 'Failed to fetch growth data' };
    }
    
    if (!analyses || analyses.length === 0) {
      return { success: false, error: 'No analysis data found' };
    }
    
    // Need at least 2 data points for growth analysis
    if (analyses.length < 2) {
      return { 
        success: false, 
        error: 'Not enough data points for growth analysis. At least 2 analyses required.' 
      };
    }
    
    console.log(`📊 Found ${analyses.length} analyses for growth chart`);
    
    // Process data points with growth calculations
    const dataPoints: GrowthDataPoint[] = analyses.map((analysis, index) => {
      const previousAnalysis = index > 0 ? analyses[index - 1] : null;
      
      let growthFromPrevious = 0;
      let daysSincePrevious = 0;
      
      if (previousAnalysis) {
        const currentCount = analysis.follower_count || 0;
        const previousCount = previousAnalysis.follower_count || 0;
        
        // Calculate percentage growth
        growthFromPrevious = previousCount > 0 
          ? ((currentCount - previousCount) / previousCount) * 100 
          : 0;
        
        // Calculate days between analyses
        const currentDate = new Date(analysis.created_at);
        const previousDate = new Date(previousAnalysis.created_at);
        daysSincePrevious = Math.round(
          (currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24)
        );
      }
      
      return {
        timestamp: analysis.created_at,
        followerCount: analysis.follower_count || 0,
        analysisId: analysis.id,
        growthFromPrevious: Math.round(growthFromPrevious * 100) / 100, // Round to 2 decimals
        daysSincePrevious
      };
    });
    
    // Calculate total growth from first to last analysis
    const firstAnalysis = analyses[0];
    const lastAnalysis = analyses[analyses.length - 1];
    const firstCount = firstAnalysis.follower_count || 0;
    const lastCount = lastAnalysis.follower_count || 0;
    
    const totalGrowthPercentage = firstCount > 0 
      ? ((lastCount - firstCount) / firstCount) * 100 
      : 0;
    const totalGrowthAbsolute = lastCount - firstCount;
    
    // Calculate timespan
    const firstDate = new Date(firstAnalysis.created_at);
    const lastDate = new Date(lastAnalysis.created_at);
    const totalDays = Math.round((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    
    let timespanText = '';
    if (totalDays === 0) {
      timespanText = 'same day';
    } else if (totalDays === 1) {
      timespanText = '1 day';
    } else if (totalDays < 7) {
      timespanText = `${totalDays} days`;
    } else if (totalDays < 30) {
      const weeks = Math.round(totalDays / 7);
      timespanText = weeks === 1 ? '1 week' : `${weeks} weeks`;
    } else {
      const months = Math.round(totalDays / 30);
      timespanText = months === 1 ? '1 month' : `${months} months`;
    }
    
    const growthData: CreatorGrowthData = {
      username: creator.username,
      platform: creator.platform,
      displayName: creator.display_name || creator.username,
      totalGrowth: {
        percentage: Math.round(totalGrowthPercentage * 100) / 100,
        absolute: totalGrowthAbsolute,
        timespan: `over ${timespanText}`
      },
      dataPoints
    };
    
    console.log(`✅ Growth data processed:`, {
      dataPoints: dataPoints.length,
      totalGrowth: `${growthData.totalGrowth.percentage}% (${growthData.totalGrowth.absolute.toLocaleString()}) ${growthData.totalGrowth.timespan}`
    });
    
    return { success: true, data: growthData };
    
  } catch (error) {
    console.error('❌ Error in getCreatorGrowthData:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Get growth summary for multiple creators (used by discovery/bookmarks pages)
 */
export async function getCreatorsGrowthSummary(
  creators: Array<{ username: string; platform: string }>
): Promise<{ success: boolean; data?: Record<string, { percentage: number; absolute: number }>; error?: string }> {
  try {
    const supabase = createServerClient();
    
    console.log(`📈 Fetching growth summaries for ${creators.length} creators`);
    
    const summaries: Record<string, { percentage: number; absolute: number }> = {};
    
    // Process each creator
    for (const creator of creators) {
      const key = `${creator.platform}:${creator.username}`;
      
      // Get creator ID
      const { data: creatorData } = await supabase
        .from('creators')
        .select('id')
        .eq('username', creator.username)
        .eq('platform', creator.platform)
        .single();
      
      if (!creatorData) continue;
      
      // Get first and last analysis
      const { data: analyses } = await supabase
        .from('creator_analyses')
        .select('follower_count, created_at')
        .eq('creator_id', creatorData.id)
        .eq('analysis_status', 'completed')
        .order('created_at', { ascending: true });
      
      if (!analyses || analyses.length < 2) continue;
      
      const firstCount = analyses[0].follower_count || 0;
      const lastCount = analyses[analyses.length - 1].follower_count || 0;
      
      const percentage = firstCount > 0 
        ? ((lastCount - firstCount) / firstCount) * 100 
        : 0;
      const absolute = lastCount - firstCount;
      
      summaries[key] = {
        percentage: Math.round(percentage * 100) / 100,
        absolute
      };
    }
    
    console.log(`✅ Growth summaries processed for ${Object.keys(summaries).length} creators`);
    
    return { success: true, data: summaries };
    
  } catch (error) {
    console.error('❌ Error in getCreatorsGrowthSummary:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}