import { supabase } from '@/lib/supabase';
import { BookmarkedCreator } from '@/lib/bookmarks';

export interface DatabaseBookmark {
  bookmark_id: string;
  user_id: string;
  creator_id: string;
  comments?: string;
  bookmarked_at: string;
  bookmark_updated_at: string;
  // Creator data from join
  username: string;
  platform: 'instagram' | 'tiktok';
  display_name?: string;
  bio?: string;
  profile_image_url?: string;
  profile_image_base64?: string;
  is_verified: boolean;
  follower_count: number;
  following_count: number;
  location?: string;
  website?: string;
  engagement_rate?: number;
  category?: string;
  ai_creator_score?: string;
  ai_brand_potential?: string;
  ai_key_strengths?: string;
  last_analysis_date?: string;
}

export class DatabaseBookmarkService {
  
  /**
   * Get all bookmarks for a user from the database
   */
  static async getUserBookmarks(userId: string): Promise<DatabaseBookmark[]> {
    try {
      const { data, error } = await supabase
        .from('user_bookmarks_with_creators')
        .select('*')
        .eq('user_id', userId)
        .order('bookmarked_at', { ascending: false });

      if (error) {
        console.error('Error fetching user bookmarks:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching user bookmarks:', error);
      return [];
    }
  }

  /**
   * Add a bookmark for a user (requires creator to exist in database)
   */
  static async addUserBookmark(
    userId: string, 
    username: string, 
    platform: 'instagram' | 'tiktok',
    comments?: string
  ): Promise<boolean> {
    try {
      // First, get or create the creator
      const creatorId = await this.getOrCreateCreator(username, platform);
      if (!creatorId) {
        console.error('Failed to get or create creator');
        return false;
      }

      // Upsert bookmark (insert or update if already exists)
      const { error } = await supabase
        .from('user_bookmarks')
        .upsert({
          user_id: userId,
          creator_id: creatorId,
          comments: comments || null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,creator_id'
        });

      if (error) {
        console.error('Error adding bookmark:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error adding bookmark:', error);
      return false;
    }
  }

  /**
   * Remove a bookmark for a user
   */
  static async removeUserBookmark(
    userId: string, 
    username: string, 
    platform: 'instagram' | 'tiktok'
  ): Promise<boolean> {
    try {
      // First find the creator
      const { data: creators, error: creatorError } = await supabase
        .from('creators')
        .select('id')
        .eq('username', username)
        .eq('platform', platform)
        .limit(1);

      if (creatorError || !creators || creators.length === 0) {
        console.error('Creator not found for bookmark removal:', creatorError);
        return false;
      }

      const creatorId = creators[0].id;

      // Delete the bookmark
      const { error } = await supabase
        .from('user_bookmarks')
        .delete()
        .eq('user_id', userId)
        .eq('creator_id', creatorId);

      if (error) {
        console.error('Error removing bookmark:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error removing bookmark:', error);
      return false;
    }
  }

  /**
   * Check if a creator is bookmarked by a user
   */
  static async isUserBookmarked(
    userId: string, 
    username: string, 
    platform: 'instagram' | 'tiktok'
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('user_bookmarks_with_creators')
        .select('bookmark_id')
        .eq('user_id', userId)
        .eq('username', username)
        .eq('platform', platform)
        .limit(1);

      if (error) {
        console.error('Error checking bookmark status:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error checking bookmark status:', error);
      return false;
    }
  }

  /**
   * Update bookmark comments
   */
  static async updateUserBookmarkComments(
    userId: string, 
    username: string, 
    platform: 'instagram' | 'tiktok',
    comments: string
  ): Promise<boolean> {
    try {
      // First find the creator
      const { data: creators, error: creatorError } = await supabase
        .from('creators')
        .select('id')
        .eq('username', username)
        .eq('platform', platform)
        .limit(1);

      if (creatorError || !creators || creators.length === 0) {
        console.error('Creator not found for comment update:', creatorError);
        return false;
      }

      const creatorId = creators[0].id;

      // Update the bookmark
      const { error } = await supabase
        .from('user_bookmarks')
        .update({
          comments,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('creator_id', creatorId);

      if (error) {
        console.error('Error updating bookmark comments:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating bookmark comments:', error);
      return false;
    }
  }

  /**
   * Clear all bookmarks for a user (for settings/export functionality)
   */
  static async clearUserBookmarks(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_bookmarks')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Error clearing user bookmarks:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error clearing user bookmarks:', error);
      return false;
    }
  }

  /**
   * Convert DatabaseBookmark to BookmarkedCreator for compatibility
   */
  static convertToBookmarkedCreator(dbBookmark: DatabaseBookmark): BookmarkedCreator {
    return {
      id: dbBookmark.bookmark_id,
      username: dbBookmark.username,
      platform: dbBookmark.platform,
      displayName: dbBookmark.display_name || dbBookmark.username,
      bio: dbBookmark.bio,
      profileImageUrl: dbBookmark.profile_image_url || '',
      isVerified: dbBookmark.is_verified,
      followerCount: dbBookmark.follower_count,
      followingCount: dbBookmark.following_count,
      website: dbBookmark.website,
      bookmarkedAt: dbBookmark.bookmarked_at,
      comments: dbBookmark.comments,
      // Add any additional fields from analysis if needed
      metrics: {
        followerCount: dbBookmark.follower_count,
        followingCount: dbBookmark.following_count,
        engagementRate: dbBookmark.engagement_rate
      },
      aiAnalysis: dbBookmark.ai_creator_score ? {
        creator_score: dbBookmark.ai_creator_score,
        category: dbBookmark.category || 'other',
        brand_potential: dbBookmark.ai_brand_potential || '',
        key_strengths: dbBookmark.ai_key_strengths || '',
        // Add other AI fields as needed
        engagement_quality: '',
        content_style: '',
        audience_demographics: '',
        collaboration_potential: '',
        overall_assessment: ''
      } : undefined
    };
  }

  /**
   * Helper function to get or create a creator in the database
   * This ensures we can bookmark creators even if they haven't been fully analyzed yet
   * First tries to find existing creator, then falls back to creating one
   */
  private static async getOrCreateCreator(username: string, platform: 'instagram' | 'tiktok'): Promise<string | null> {
    try {  
      // First try to find existing creator
      const { data: existingCreator, error: findError } = await supabase
        .from('creators')
        .select('id')
        .eq('username', username)
        .eq('platform', platform)
        .limit(1);

      if (!findError && existingCreator && existingCreator.length > 0) {
        return existingCreator[0].id;
      }

      // Try to use RPC function for creating
      const { data, error } = await supabase
        .rpc('get_or_create_creator', {
          p_username: username,
          p_platform: platform
        });

      if (!error && data) {
        return data as string;
      }

      // Fallback: create creator manually
      console.warn('RPC function failed, creating creator manually:', error);
      const { data: newCreator, error: createError } = await supabase
        .from('creators')
        .insert({
          username: username,
          platform: platform,
          display_name: username,
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (createError) {
        console.error('Error creating creator manually:', createError);
        return null;
      }

      return newCreator.id;
    } catch (error) {
      console.error('Error in getOrCreateCreator:', error);
      return null;
    }
  }
}