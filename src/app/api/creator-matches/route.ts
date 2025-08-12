import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CreatorMatchingService } from '@/lib/creator-matching/matching-service';
import { supabase } from '@/lib/supabase';

// Validation schema
const matchingRequestSchema = z.object({
  username: z.string().min(1).max(50).trim(),
  platform: z.enum(['instagram', 'tiktok'])
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse and validate query parameters
    const params = matchingRequestSchema.parse({
      username: searchParams.get('username'),
      platform: searchParams.get('platform')
    });

    console.log(`🔍 Creator matching request: ${params.platform}/@${params.username}`);

    // Get the target creator's profile data
    const { data: creatorData, error } = await supabase
      .from('creator_discovery_enriched')
      .select(`
        username,
        platform,
        display_name,
        bio,
        profile_image_url,
        website,
        location,
        follower_count,
        following_count,
        is_verified,
        ai_content_style,
        ai_audience_demographics,
        category
      `)
      .eq('username', params.username)
      .eq('platform', params.platform)
      .single();

    if (error || !creatorData) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Creator @${params.username} not found on ${params.platform}` 
        },
        { status: 404 }
      );
    }

    // Convert to CreatorProfile format
    const targetProfile = {
      username: creatorData.username,
      platform: creatorData.platform as 'instagram' | 'tiktok',
      displayName: creatorData.display_name || creatorData.username,
      bio: creatorData.bio,
      profileImageUrl: creatorData.profile_image_url,
      website: creatorData.website,
      location: creatorData.location,
      followerCount: creatorData.follower_count || 0,
      followingCount: creatorData.following_count || 0,
      isVerified: creatorData.is_verified || false,
      aiAnalysis: {
        content_style: creatorData.ai_content_style || '',
        audience_demographics: creatorData.ai_audience_demographics || '',
        category: creatorData.category || ''
      }
    };

    // Find potential matches
    const matchingResult = await CreatorMatchingService.findPotentialMatches(targetProfile);

    // Save results for caching (future enhancement)
    await CreatorMatchingService.saveMatchResults(
      params.username,
      params.platform,
      matchingResult
    );

    return NextResponse.json({
      success: true,
      data: {
        targetCreator: {
          username: targetProfile.username,
          platform: targetProfile.platform,
          displayName: targetProfile.displayName,
          followerCount: targetProfile.followerCount
        },
        ...matchingResult
      }
    });

  } catch (error) {
    console.error('❌ Creator matching API error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request parameters',
          details: error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    // Handle other errors
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}