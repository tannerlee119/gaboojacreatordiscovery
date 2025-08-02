import { Platform } from '@/lib/types';

export interface NormalizationResult {
  normalized: Record<string, unknown>;
  transformations: string[];
  issues: string[];
}

export class DataNormalizer {
  /**
   * Normalize scraped creator data to standard format
   */
  static normalizeCreatorData(rawData: Record<string, unknown>, platform: Platform): NormalizationResult {
    const normalized: Record<string, unknown> = {};
    const transformations: string[] = [];
    const issues: string[] = [];

    try {
      // Normalize username
      if (typeof rawData.username === 'string') {
        normalized.username = this.normalizeUsername(rawData.username);
        if (normalized.username !== rawData.username) {
          transformations.push(`Username: "${rawData.username}" → "${normalized.username}"`);
        }
      } else {
        issues.push('Username is missing or not a string');
      }

      // Normalize platform
      normalized.platform = platform;

      // Normalize display name
      if (typeof rawData.displayName === 'string') {
        normalized.displayName = this.normalizeDisplayName(rawData.displayName);
        if (normalized.displayName !== rawData.displayName) {
          transformations.push(`Display name normalized`);
        }
      } else if (typeof rawData.display_name === 'string') {
        normalized.displayName = this.normalizeDisplayName(rawData.display_name);
        transformations.push('Used display_name field for displayName');
      } else {
        // Fallback to username
        normalized.displayName = normalized.username || 'Unknown';
        issues.push('Display name missing, using username as fallback');
      }

      // Normalize bio
      if (typeof rawData.bio === 'string') {
        normalized.bio = this.normalizeBio(rawData.bio);
      }

      // Normalize follower count
      normalized.followerCount = this.normalizeCount(rawData.followerCount || rawData.followers || rawData.follower_count);
      if (typeof rawData.followerCount !== 'number' && normalized.followerCount !== undefined) {
        transformations.push(`Follower count: "${rawData.followerCount}" → ${normalized.followerCount}`);
      }

      // Normalize following count
      normalized.followingCount = this.normalizeCount(rawData.followingCount || rawData.following || rawData.following_count);

      // Normalize verification status
      normalized.isVerified = this.normalizeBoolean(rawData.isVerified || rawData.verified || rawData.is_verified);

      // Normalize profile image URL
      if (rawData.profileImageUrl || rawData.profile_image_url || rawData.avatar) {
        normalized.profileImageUrl = this.normalizeUrl(
          rawData.profileImageUrl as string || 
          rawData.profile_image_url as string || 
          rawData.avatar as string
        );
      }

      // Normalize location
      if (rawData.location) {
        normalized.location = this.normalizeLocation(rawData.location as string);
      }

      // Normalize website URL
      if (rawData.website || rawData.website_url || rawData.external_url) {
        normalized.website = this.normalizeUrl(
          rawData.website as string || 
          rawData.website_url as string || 
          rawData.external_url as string
        );
      }

      // Normalize metrics based on platform
      if (rawData.metrics) {
        normalized.metrics = this.normalizeMetrics(rawData.metrics as Record<string, unknown>, platform);
      }

      return {
        normalized,
        transformations,
        issues
      };

    } catch (error) {
      issues.push(`Normalization error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        normalized: rawData,
        transformations,
        issues
      };
    }
  }

  /**
   * Normalize username to lowercase and remove invalid characters
   */
  private static normalizeUsername(username: string): string {
    return username
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9._]/g, '') // Remove invalid characters
      .substring(0, 30); // Limit length
  }

  /**
   * Normalize display name
   */
  private static normalizeDisplayName(displayName: string): string {
    return displayName
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .substring(0, 100); // Limit length
  }

  /**
   * Normalize bio text
   */
  private static normalizeBio(bio: string): string {
    return bio
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .substring(0, 500); // Limit length
  }

  /**
   * Normalize count values (followers, following, etc.)
   */
  private static normalizeCount(value: unknown): number | undefined {
    if (typeof value === 'number') {
      return Math.max(0, Math.floor(value)); // Ensure non-negative integer
    }
    
    if (typeof value === 'string') {
      // Handle string numbers like "1.2K", "5M", etc.
      const normalized = this.parseCountString(value);
      return normalized !== null ? normalized : undefined;
    }
    
    return undefined;
  }

  /**
   * Parse count strings like "1.2K", "5M", "500"
   */
  private static parseCountString(countStr: string): number | null {
    const cleaned = countStr.replace(/[,\s]/g, '').toLowerCase();
    
    if (/^\d+$/.test(cleaned)) {
      return parseInt(cleaned, 10);
    }
    
    const match = cleaned.match(/^(\d+(?:\.\d+)?)([kmb])$/);
    if (!match) return null;
    
    const number = parseFloat(match[1]);
    const multiplier = match[2];
    
    switch (multiplier) {
      case 'k': return Math.floor(number * 1000);
      case 'm': return Math.floor(number * 1000000);
      case 'b': return Math.floor(number * 1000000000);
      default: return null;
    }
  }

  /**
   * Normalize boolean values
   */
  private static normalizeBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return ['true', 'yes', '1', 'verified'].includes(value.toLowerCase());
    }
    if (typeof value === 'number') {
      return value > 0;
    }
    return false;
  }

  /**
   * Normalize URL values
   */
  private static normalizeUrl(url: string): string | undefined {
    if (!url || typeof url !== 'string') return undefined;
    
    const cleaned = url.trim();
    if (!cleaned) return undefined;
    
    // Add protocol if missing
    if (!/^https?:\/\//.test(cleaned)) {
      return `https://${cleaned}`;
    }
    
    try {
      const urlObj = new URL(cleaned);
      return urlObj.toString();
    } catch {
      return undefined; // Invalid URL
    }
  }

  /**
   * Normalize location string
   */
  private static normalizeLocation(location: string): string | undefined {
    const cleaned = location.trim();
    if (!cleaned) return undefined;
    
    return cleaned
      .replace(/\s+/g, ' ')
      .substring(0, 100); // Limit length
  }

  /**
   * Normalize platform-specific metrics
   */
  private static normalizeMetrics(metrics: Record<string, unknown>, platform: Platform): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};
    
    switch (platform) {
      case 'instagram':
        normalized.followerCount = this.normalizeCount(metrics.followerCount || metrics.followers);
        normalized.followingCount = this.normalizeCount(metrics.followingCount || metrics.following);
        normalized.postCount = this.normalizeCount(metrics.postCount || metrics.posts);
        normalized.averageLikes = this.normalizeCount(metrics.averageLikes || metrics.avg_likes);
        normalized.averageComments = this.normalizeCount(metrics.averageComments || metrics.avg_comments);
        normalized.engagementRate = this.normalizePercentage(metrics.engagementRate || metrics.engagement_rate);
        break;
        
      case 'tiktok':
        normalized.followerCount = this.normalizeCount(metrics.followerCount || metrics.followers);
        normalized.followingCount = this.normalizeCount(metrics.followingCount || metrics.following);
        normalized.likeCount = this.normalizeCount(metrics.likeCount || metrics.likes);
        normalized.videoCount = this.normalizeCount(metrics.videoCount || metrics.videos);
        normalized.averageViews = this.normalizeCount(metrics.averageViews || metrics.avg_views);
        normalized.averageLikes = this.normalizeCount(metrics.averageLikes || metrics.avg_likes);
        normalized.engagementRate = this.normalizePercentage(metrics.engagementRate || metrics.engagement_rate);
        break;
        
      case 'youtube':
        normalized.subscriberCount = this.normalizeCount(metrics.subscriberCount || metrics.subscribers);
        normalized.videoCount = this.normalizeCount(metrics.videoCount || metrics.videos);
        normalized.viewCount = this.normalizeCount(metrics.viewCount || metrics.views);
        normalized.averageViews = this.normalizeCount(metrics.averageViews || metrics.avg_views);
        normalized.averageLikes = this.normalizeCount(metrics.averageLikes || metrics.avg_likes);
        normalized.averageComments = this.normalizeCount(metrics.averageComments || metrics.avg_comments);
        normalized.engagementRate = this.normalizePercentage(metrics.engagementRate || metrics.engagement_rate);
        break;
    }
    
    return normalized;
  }

  /**
   * Normalize percentage values (0-100)
   */
  private static normalizePercentage(value: unknown): number | undefined {
    if (typeof value === 'number') {
      return Math.max(0, Math.min(100, value));
    }
    
    if (typeof value === 'string') {
      const cleaned = value.replace(/%/g, '');
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) {
        return Math.max(0, Math.min(100, parsed));
      }
    }
    
    return undefined;
  }

  /**
   * Batch normalize multiple creator profiles
   */
  static batchNormalize(profiles: Array<{ data: Record<string, unknown>; platform: Platform }>): Array<NormalizationResult> {
    return profiles.map(({ data, platform }) => this.normalizeCreatorData(data, platform));
  }

  /**
   * Get normalization statistics
   */
  static getNormalizationStats(results: NormalizationResult[]): {
    totalTransformations: number;
    totalIssues: number;
    commonIssues: Record<string, number>;
    successRate: number;
  } {
    const stats = {
      totalTransformations: 0,
      totalIssues: 0,
      commonIssues: {} as Record<string, number>,
      successRate: 0
    };

    results.forEach(result => {
      stats.totalTransformations += result.transformations.length;
      stats.totalIssues += result.issues.length;
      
      result.issues.forEach(issue => {
        stats.commonIssues[issue] = (stats.commonIssues[issue] || 0) + 1;
      });
    });

    stats.successRate = ((results.length - results.filter(r => r.issues.length > 0).length) / results.length) * 100;

    return stats;
  }
} 