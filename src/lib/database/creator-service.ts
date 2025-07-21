import { createServerClient } from '@/lib/supabase';

interface CreatorProfileData {
  username: string;
  platform: string;
  displayName: string;
  bio?: string;
  profileImageUrl?: string;
  isVerified: boolean;
  followerCount?: number;
  followingCount?: number;
  location?: string;
  website?: string;
  metrics?: {
    followerCount?: number;
    followingCount?: number;
    postCount?: number;
    engagementRate?: number;
    averageLikes?: number;
    averageComments?: number;
  };
}

export async function saveCreatorProfile(profile: CreatorProfileData): Promise<void> {
  try {
    const supabase = createServerClient();
    
    // First, insert or update the creator
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .upsert({
        username: profile.username,
        platform: profile.platform,
        display_name: profile.displayName,
        bio: profile.bio,
        profile_image_url: profile.profileImageUrl,
        is_verified: profile.isVerified,
        follower_count: profile.followerCount || 0,
        following_count: profile.followingCount || 0,
        location: profile.location,
        website_url: profile.website,
        last_scraped_at: new Date().toISOString(),
        scraping_status: 'completed',
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'username,platform',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (creatorError) {
      console.error('Error saving creator:', creatorError);
      throw creatorError;
    }

    // Save platform-specific metrics
    if (profile.platform === 'instagram' && profile.metrics) {
      const { error: metricsError } = await supabase
        .from('instagram_metrics')
        .insert({
          creator_id: creator.id,
          follower_count: profile.metrics.followerCount || 0,
          following_count: profile.metrics.followingCount || 0,
          post_count: profile.metrics.postCount || 0,
          average_likes: profile.metrics.averageLikes || 0,
          average_comments: profile.metrics.averageComments || 0,
          engagement_rate: profile.metrics.engagementRate || 0,
          scraped_at: new Date().toISOString()
        });

      if (metricsError) {
        console.error('Error saving Instagram metrics:', metricsError);
      }
    }

    console.log(`Creator profile saved successfully: ${profile.username}`);
  } catch (error) {
    console.error('Database save error:', error);
    throw error;
  }
} 