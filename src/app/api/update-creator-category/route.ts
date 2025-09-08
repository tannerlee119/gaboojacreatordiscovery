import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { DiscoveryCache } from '@/lib/cache/discovery-cache';

// Validation schema for category update
const updateCategorySchema = z.object({
  username: z.string().min(1, 'Username is required'),
  platform: z.enum(['instagram', 'tiktok'], { required_error: 'Platform must be instagram or tiktok' }),
  category: z.enum([
    'lifestyle', 'fashion', 'beauty', 'fitness', 'sports', 'food', 'travel',
    'tech', 'gaming', 'music', 'comedy', 'education', 'business',
    'art', 'pets', 'family', 'other'
  ], { required_error: 'Invalid category' })
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate the request body
    const { username, platform, category } = updateCategorySchema.parse(body);
    
    console.log(`Updating category for @${username} on ${platform} to ${category}`);
    
    // Update the creator's category in the database
    const { data, error } = await supabase
      .from('creators')
      .update({ category })
      .eq('username', username)
      .eq('platform', platform)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating creator category:', error);
      return NextResponse.json(
        { error: 'Failed to update creator category', details: error.message },
        { status: 500 }
      );
    }
    
    if (!data) {
      return NextResponse.json(
        { error: 'Creator not found' },
        { status: 404 }
      );
    }

    // Invalidate cache when creator category is updated
    try {
      await DiscoveryCache.invalidateCreatorCache(data.id);
      console.log(`🧹 Cache invalidated for creator category update: ${username}`);
    } catch (cacheError) {
      console.error('⚠️ Failed to invalidate cache after category update:', cacheError);
      // Don't fail the request if cache invalidation fails
    }
    
    console.log(`Successfully updated category for @${username} to ${category}`);
    
    return NextResponse.json({
      success: true,
      message: `Category updated to ${category}`,
      creator: {
        username: data.username,
        platform: data.platform,
        category: data.category
      }
    });
    
  } catch (error) {
    console.error('Update category API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}