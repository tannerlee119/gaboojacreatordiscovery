import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { DiscoveryCache, type CreatorGrowthData } from '@/lib/cache/discovery-cache';

// Validation schema for discovery filters
const discoveryFiltersSchema = z.object({
  platform: z.enum(['all', 'instagram', 'tiktok']).optional().default('all'),
  category: z.array(z.enum([
    'lifestyle', 'fashion', 'beauty', 'fitness', 'sports', 'food', 'travel',
    'tech', 'gaming', 'music', 'comedy', 'education', 'business',
    'art', 'pets', 'family', 'other'
  ])).optional(),
  minFollowers: z.number().min(0).optional().default(0),
  maxFollowers: z.number().min(0).optional().default(10000000),
  verified: z.boolean().optional(),
  sortBy: z.enum(['followers-desc', 'followers-asc']).optional().default('followers-desc'),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(50).optional().default(12)
});

// Database creator type from Supabase
interface DatabaseCreator {
  id: string;
  username: string;
  platform: string;
  display_name?: string;
  ai_overall_assessment?: string;
  is_verified?: boolean;
  follower_count?: number;
  following_count?: number;
  category?: string;
  ai_creator_score?: string;
  location?: string;
  website?: string;
  bio?: string;
  profile_image_url?: string;
  engagement_rate?: number;
  ai_brand_potential?: string;
  ai_key_strengths?: string;
  ai_engagement_quality?: string;
  ai_content_style?: string;
  ai_audience_demographics?: string;
  ai_collaboration_potential?: string;
  last_analysis_date?: string;
  // Growth data fields (calculated)
  previous_follower_count?: number;
  growth_percentage?: number;
}

// Helper function to calculate and cache growth data
async function calculateAndCacheGrowthData(creator: DatabaseCreator) {
  try {
    // Get the latest analysis data
    const { data: latestAnalysis } = await supabase
      .from('creator_analyses')
      .select('follower_count, created_at')
      .eq('creator_id', creator.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    // Use the latest analysis data if it's newer than what's in the view
    let currentFollowerCount = creator.follower_count;
    if (latestAnalysis && latestAnalysis.created_at > (creator.last_analysis_date || '')) {
      currentFollowerCount = latestAnalysis.follower_count;
    }
    
    // Get previous analysis for growth calculation
    const { data: previousAnalysis } = await supabase
      .from('creator_analyses')
      .select('follower_count, created_at')
      .eq('creator_id', creator.id)
      .lt('created_at', creator.last_analysis_date || new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let growthData: CreatorGrowthData = {
      current_follower_count: currentFollowerCount,
      previous_follower_count: undefined,
      growth_percentage: undefined
    };

    if (previousAnalysis && previousAnalysis.follower_count) {
      const currentCount = currentFollowerCount || 0;
      const previousCount = previousAnalysis.follower_count || 0;
      const growthPercentage = previousCount > 0 
        ? ((currentCount - previousCount) / previousCount) * 100 
        : 0;
      
      growthData = {
        current_follower_count: currentCount,
        previous_follower_count: previousCount,
        growth_percentage: Math.round(growthPercentage * 100) / 100
      };
    }

    // Cache the calculated growth data
    await DiscoveryCache.cacheCreatorGrowthData(creator.id, growthData);
    
    return growthData;
  } catch (error) {
    console.error(`Error calculating growth data for creator ${creator.id}:`, error);
    return {
      current_follower_count: creator.follower_count,
      previous_follower_count: undefined,
      growth_percentage: undefined
    };
  }
}

// Helper function to map database results to frontend interface
function mapDatabaseCreatorToDiscoveryCreator(dbCreator: DatabaseCreator) {
  return {
    id: dbCreator.id,
    username: dbCreator.username,
    platform: dbCreator.platform,
    displayName: dbCreator.display_name || dbCreator.username,
    overallAssessment: dbCreator.ai_overall_assessment || `${dbCreator.display_name || dbCreator.username} - ${dbCreator.category || 'creator'} content`,
    isVerified: dbCreator.is_verified || false,
    followerCount: dbCreator.follower_count || 0,
    followingCount: dbCreator.following_count || 0,
    category: dbCreator.category || 'other',
    aiScore: dbCreator.ai_creator_score || '0',
    location: dbCreator.location,
    website: dbCreator.website,
    bio: dbCreator.bio,
    profileImageUrl: dbCreator.profile_image_url,
    engagementRate: dbCreator.engagement_rate || 0,
    // AI analysis fields
    brandPotential: dbCreator.ai_brand_potential,
    keyStrengths: dbCreator.ai_key_strengths,
    engagementQuality: dbCreator.ai_engagement_quality,
    contentStyle: dbCreator.ai_content_style,
    audienceDemographics: dbCreator.ai_audience_demographics,
    collaborationPotential: dbCreator.ai_collaboration_potential,
    lastAnalysisDate: dbCreator.last_analysis_date,
    // Include growth data if available
    growthData: (dbCreator.previous_follower_count && dbCreator.growth_percentage !== undefined) ? {
      previousFollowerCount: dbCreator.previous_follower_count,
      growthPercentage: dbCreator.growth_percentage
    } : undefined
  };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse and validate query parameters
    const filters = discoveryFiltersSchema.parse({
      platform: searchParams.get('platform') || 'all',
      category: searchParams.get('category')?.split(',') || undefined,
      minFollowers: searchParams.get('minFollowers') ? parseInt(searchParams.get('minFollowers')!) : undefined,
      maxFollowers: searchParams.get('maxFollowers') ? parseInt(searchParams.get('maxFollowers')!) : undefined,
      verified: searchParams.get('verified') ? searchParams.get('verified') === 'true' : undefined,
      sortBy: searchParams.get('sortBy') || 'followers-desc',
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 12
    });

    // Try to get cached results first
    const cachedResults = await DiscoveryCache.getCachedResults(filters, filters.page);
    if (cachedResults) {
      const totalTime = Date.now() - startTime;
      const response = NextResponse.json(cachedResults);
      
      // Add performance headers
      response.headers.set('X-Cache', 'HIT');
      response.headers.set('X-Response-Time', `${totalTime}ms`);
      response.headers.set('X-Data-Source', 'Redis');
      
      return response;
    }

    console.log(`🔍 Cache MISS - fetching from database for page ${filters.page}`);

    // Build database query using the creator_discovery view
    let query = supabase
      .from('creator_discovery')
      .select('*');

    // Apply filters
    if (filters.platform !== 'all') {
      query = query.eq('platform', filters.platform);
    }

    if (filters.category && filters.category.length > 0) {
      query = query.in('category', filters.category);
    }

    if (filters.minFollowers > 0) {
      query = query.gte('follower_count', filters.minFollowers);
    }

    if (filters.maxFollowers < 10000000) {
      query = query.lte('follower_count', filters.maxFollowers);
    }

    if (filters.verified !== undefined) {
      query = query.eq('is_verified', filters.verified);
    }

    // Add sorting
    switch (filters.sortBy) {
      case 'followers-desc':
        query = query.order('follower_count', { ascending: false });
        break;
      case 'followers-asc':
        query = query.order('follower_count', { ascending: true });
        break;
    }

    // Try to get cached filter count for pagination
    let count = await DiscoveryCache.getCachedFilterCount(filters);
    
    if (count === null) {
      // Get total count for pagination (before applying limit/offset) if not cached
      let countQuery = supabase
        .from('creator_discovery')
        .select('*', { count: 'exact', head: true });

      // Apply same filters to count query
      if (filters.platform !== 'all') {
        countQuery = countQuery.eq('platform', filters.platform);
      }

      if (filters.category && filters.category.length > 0) {
        countQuery = countQuery.in('category', filters.category);
      }

      if (filters.minFollowers > 0) {
        countQuery = countQuery.gte('follower_count', filters.minFollowers);
      }

      if (filters.maxFollowers < 10000000) {
        countQuery = countQuery.lte('follower_count', filters.maxFollowers);
      }

      if (filters.verified !== undefined) {
        countQuery = countQuery.eq('is_verified', filters.verified);
      }

      const { count: dbCount } = await countQuery;
      count = dbCount || 0;
      
      // Cache the count for future requests
      await DiscoveryCache.cacheFilterCount(filters, count);
    }

    // Apply pagination
    const startIndex = (filters.page - 1) * filters.limit;
    query = query.range(startIndex, startIndex + filters.limit - 1);

    // Execute query
    const { data: creators, error } = await query;

    if (error) {
      console.error('Database query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch creators from database' },
        { status: 500 }
      );
    }

    // Get growth data efficiently using Redis cache
    const creatorsWithGrowth = await Promise.all((creators || []).map(async (creator) => {
      // Try to get cached growth data first
      let growthData = await DiscoveryCache.getCreatorGrowthData(creator.id);
      
      if (!growthData) {
        // Cache miss - calculate growth data and cache it
        growthData = await calculateAndCacheGrowthData(creator);
      }
      
      return {
        ...creator,
        // Use cached or calculated growth data
        follower_count: growthData?.current_follower_count || creator.follower_count,
        previous_follower_count: growthData?.previous_follower_count,
        growth_percentage: growthData?.growth_percentage
      };
    }));

    // Map database results to frontend interface
    const mappedCreators = creatorsWithGrowth.map(mapDatabaseCreatorToDiscoveryCreator);

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / filters.limit);

    // Build the response data
    const responseData = {
      creators: mappedCreators,
      totalCount,
      currentPage: filters.page,
      totalPages,
      hasNextPage: startIndex + filters.limit < totalCount,
      appliedFilters: filters
    };

    // Cache the complete result for future requests
    await DiscoveryCache.cacheResults(filters, filters.page, responseData);

    // Calculate total response time
    const totalTime = Date.now() - startTime;
    console.log(`✅ Discovery query completed in ${totalTime}ms (${mappedCreators.length} creators)`);

    const response = NextResponse.json(responseData);
    
    // Add performance headers
    response.headers.set('X-Cache', 'MISS');
    response.headers.set('X-Response-Time', `${totalTime}ms`);
    response.headers.set('X-Data-Source', 'Database');
    response.headers.set('X-Creators-Count', mappedCreators.length.toString());

    return response;

  } catch (error) {
    console.error('Discovery API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid filter parameters', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch creators' },
      { status: 500 }
    );
  }
}