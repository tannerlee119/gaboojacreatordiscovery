import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';

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
    lastAnalysisDate: dbCreator.last_analysis_date
  };
}

export async function GET(request: NextRequest) {
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

    // Get total count for pagination (before applying limit/offset)
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

    const { count } = await countQuery;

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

    // Map database results to frontend interface
    const mappedCreators = (creators || []).map(mapDatabaseCreatorToDiscoveryCreator);

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / filters.limit);

    return NextResponse.json({
      creators: mappedCreators,
      totalCount,
      currentPage: filters.page,
      totalPages,
      hasNextPage: startIndex + filters.limit < totalCount,
      appliedFilters: filters
    });

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