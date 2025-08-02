import { Platform } from '@/lib/types';

export interface DuplicateMatch {
  profile1: string; // identifier
  profile2: string; // identifier  
  similarity: number; // 0-100
  reasons: DuplicateReason[];
  confidence: 'high' | 'medium' | 'low';
  recommendation: 'merge' | 'investigate' | 'keep_separate';
}

export interface DuplicateReason {
  type: 'exact_match' | 'similar_name' | 'same_image' | 'similar_metrics' | 'same_bio' | 'same_location';
  field: string;
  similarity: number;
  value1: string;
  value2: string;
}

export interface ProfileIdentifier {
  id: string;
  username: string;
  platform: Platform;
  displayName: string;
  bio?: string;
  profileImageUrl?: string;
  location?: string;
  followerCount?: number;
  isVerified?: boolean;
}

export class DuplicateDetector {
  /**
   * Find potential duplicates in a set of profiles
   */
  static findDuplicates(profiles: ProfileIdentifier[]): DuplicateMatch[] {
    const matches: DuplicateMatch[] = [];
    
    // Compare each profile with every other profile
    for (let i = 0; i < profiles.length; i++) {
      for (let j = i + 1; j < profiles.length; j++) {
        const profile1 = profiles[i];
        const profile2 = profiles[j];
        
        // Skip if different platforms (usually not duplicates)
        if (profile1.platform !== profile2.platform) {
          continue;
        }
        
        const match = this.compareProfiles(profile1, profile2);
        if (match.similarity >= 30) { // Only report matches above 30% similarity
          matches.push(match);
        }
      }
    }
    
    // Sort by similarity (highest first)
    return matches.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Compare two profiles for similarity
   */
  private static compareProfiles(profile1: ProfileIdentifier, profile2: ProfileIdentifier): DuplicateMatch {
    const reasons: DuplicateReason[] = [];
    let totalSimilarity = 0;
    let weightSum = 0;

    // Username comparison (high weight)
    const usernameMatch = this.compareUsernames(profile1.username, profile2.username);
    if (usernameMatch.similarity > 0) {
      reasons.push({
        type: usernameMatch.similarity === 100 ? 'exact_match' : 'similar_name',
        field: 'username',
        similarity: usernameMatch.similarity,
        value1: profile1.username,
        value2: profile2.username
      });
      totalSimilarity += usernameMatch.similarity * 0.3; // 30% weight
      weightSum += 0.3;
    }

    // Display name comparison (medium weight)
    const displayNameMatch = this.compareDisplayNames(profile1.displayName, profile2.displayName);
    if (displayNameMatch.similarity > 0) {
      reasons.push({
        type: displayNameMatch.similarity === 100 ? 'exact_match' : 'similar_name',
        field: 'displayName',
        similarity: displayNameMatch.similarity,
        value1: profile1.displayName,
        value2: profile2.displayName
      });
      totalSimilarity += displayNameMatch.similarity * 0.25; // 25% weight
      weightSum += 0.25;
    }

    // Bio comparison (medium weight)
    if (profile1.bio && profile2.bio) {
      const bioMatch = this.compareBios(profile1.bio, profile2.bio);
      if (bioMatch.similarity > 0) {
        reasons.push({
          type: bioMatch.similarity === 100 ? 'exact_match' : 'same_bio',
          field: 'bio',
          similarity: bioMatch.similarity,
          value1: profile1.bio.substring(0, 50) + '...',
          value2: profile2.bio.substring(0, 50) + '...'
        });
        totalSimilarity += bioMatch.similarity * 0.2; // 20% weight
        weightSum += 0.2;
      }
    }

    // Profile image comparison (medium weight)
    if (profile1.profileImageUrl && profile2.profileImageUrl) {
      const imageMatch = this.compareProfileImages(profile1.profileImageUrl, profile2.profileImageUrl);
      if (imageMatch.similarity > 0) {
        reasons.push({
          type: 'same_image',
          field: 'profileImageUrl',
          similarity: imageMatch.similarity,
          value1: profile1.profileImageUrl,
          value2: profile2.profileImageUrl
        });
        totalSimilarity += imageMatch.similarity * 0.15; // 15% weight
        weightSum += 0.15;
      }
    }

    // Location comparison (low weight)
    if (profile1.location && profile2.location) {
      const locationMatch = this.compareLocations(profile1.location, profile2.location);
      if (locationMatch.similarity > 0) {
        reasons.push({
          type: locationMatch.similarity === 100 ? 'exact_match' : 'same_location',
          field: 'location',
          similarity: locationMatch.similarity,
          value1: profile1.location,
          value2: profile2.location
        });
        totalSimilarity += locationMatch.similarity * 0.05; // 5% weight
        weightSum += 0.05;
      }
    }

    // Follower count similarity (low weight)
    if (profile1.followerCount !== undefined && profile2.followerCount !== undefined) {
      const metricsMatch = this.compareMetrics(profile1.followerCount, profile2.followerCount);
      if (metricsMatch.similarity > 0) {
        reasons.push({
          type: 'similar_metrics',
          field: 'followerCount',
          similarity: metricsMatch.similarity,
          value1: profile1.followerCount.toString(),
          value2: profile2.followerCount.toString()
        });
        totalSimilarity += metricsMatch.similarity * 0.05; // 5% weight
        weightSum += 0.05;
      }
    }

    // Calculate final similarity (normalize by weight sum)
    const similarity = weightSum > 0 ? Math.round(totalSimilarity / weightSum) : 0;
    
    // Determine confidence and recommendation
    const confidence = this.determineConfidence(similarity, reasons);
    const recommendation = this.getRecommendation(similarity, reasons, profile1, profile2);

    return {
      profile1: `${profile1.platform}:${profile1.username}`,
      profile2: `${profile2.platform}:${profile2.username}`,
      similarity,
      reasons,
      confidence,
      recommendation
    };
  }

  /**
   * Compare usernames using fuzzy matching
   */
  private static compareUsernames(username1: string, username2: string): { similarity: number } {
    const clean1 = username1.toLowerCase().replace(/[._]/g, '');
    const clean2 = username2.toLowerCase().replace(/[._]/g, '');
    
    if (clean1 === clean2) {
      return { similarity: 100 };
    }
    
    // Check if one is substring of another
    if (clean1.includes(clean2) || clean2.includes(clean1)) {
      const longer = clean1.length > clean2.length ? clean1 : clean2;
      const shorter = clean1.length <= clean2.length ? clean1 : clean2;
      return { similarity: Math.round((shorter.length / longer.length) * 80) };
    }
    
    // Levenshtein distance similarity
    const distance = this.levenshteinDistance(clean1, clean2);
    const maxLength = Math.max(clean1.length, clean2.length);
    const similarity = Math.round((1 - distance / maxLength) * 100);
    
    return { similarity: Math.max(0, similarity) };
  }

  /**
   * Compare display names using fuzzy matching
   */
  private static compareDisplayNames(name1: string, name2: string): { similarity: number } {
    const clean1 = name1.toLowerCase().trim();
    const clean2 = name2.toLowerCase().trim();
    
    if (clean1 === clean2) {
      return { similarity: 100 };
    }
    
    // Remove common variations
    const normalized1 = clean1.replace(/\s+/g, ' ').replace(/[^\w\s]/g, '');
    const normalized2 = clean2.replace(/\s+/g, ' ').replace(/[^\w\s]/g, '');
    
    if (normalized1 === normalized2) {
      return { similarity: 95 };
    }
    
    // Check if one contains the other
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return { similarity: 80 };
    }
    
    // Fuzzy matching
    const distance = this.levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);
    const similarity = Math.round((1 - distance / maxLength) * 100);
    
    return { similarity: Math.max(0, similarity - 20) }; // Lower threshold for display names
  }

  /**
   * Compare bios using text similarity
   */
  private static compareBios(bio1: string, bio2: string): { similarity: number } {
    const clean1 = bio1.toLowerCase().trim().replace(/\s+/g, ' ');
    const clean2 = bio2.toLowerCase().trim().replace(/\s+/g, ' ');
    
    if (clean1 === clean2) {
      return { similarity: 100 };
    }
    
    // Check for substantial overlap
    const words1 = clean1.split(' ');
    const words2 = clean2.split(' ');
    const commonWords = words1.filter(word => words2.includes(word));
    
    if (commonWords.length === 0) {
      return { similarity: 0 };
    }
    
    const overlapRatio = (commonWords.length * 2) / (words1.length + words2.length);
    return { similarity: Math.round(overlapRatio * 100) };
  }

  /**
   * Compare profile image URLs
   */
  private static compareProfileImages(url1: string, url2: string): { similarity: number } {
    // Exact URL match
    if (url1 === url2) {
      return { similarity: 100 };
    }
    
    // Extract filename/hash from URLs for comparison
    const getImageId = (url: string): string => {
      try {
        const urlObj = new URL(url);
        const path = urlObj.pathname;
        const filename = path.split('/').pop() || '';
        return filename.split('.')[0]; // Remove extension
      } catch {
        return '';
      }
    };
    
    const id1 = getImageId(url1);
    const id2 = getImageId(url2);
    
    if (id1 && id2 && id1 === id2) {
      return { similarity: 90 };
    }
    
    return { similarity: 0 };
  }

  /**
   * Compare locations
   */
  private static compareLocations(location1: string, location2: string): { similarity: number } {
    const clean1 = location1.toLowerCase().trim();
    const clean2 = location2.toLowerCase().trim();
    
    if (clean1 === clean2) {
      return { similarity: 100 };
    }
    
    // Check if one contains the other (e.g., "New York" vs "New York, NY")
    if (clean1.includes(clean2) || clean2.includes(clean1)) {
      return { similarity: 80 };
    }
    
    return { similarity: 0 };
  }

  /**
   * Compare follower count metrics
   */
  private static compareMetrics(count1: number, count2: number): { similarity: number } {
    if (count1 === count2) {
      return { similarity: 100 };
    }
    
    const diff = Math.abs(count1 - count2);
    const avg = (count1 + count2) / 2;
    
    if (avg === 0) {
      return { similarity: 100 }; // Both zero
    }
    
    const diffRatio = diff / avg;
    
    // If within 5% difference, high similarity
    if (diffRatio <= 0.05) {
      return { similarity: 90 };
    }
    
    // If within 20% difference, medium similarity
    if (diffRatio <= 0.2) {
      return { similarity: 60 };
    }
    
    return { similarity: 0 };
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Determine confidence level based on similarity and reasons
   */
  private static determineConfidence(similarity: number, reasons: DuplicateReason[]): 'high' | 'medium' | 'low' {
    const exactMatches = reasons.filter(r => r.type === 'exact_match').length;
    const highSimilarityMatches = reasons.filter(r => r.similarity >= 90).length;
    
    if (similarity >= 80 && (exactMatches >= 2 || highSimilarityMatches >= 3)) {
      return 'high';
    }
    
    if (similarity >= 60 && (exactMatches >= 1 || highSimilarityMatches >= 2)) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Get recommendation based on similarity analysis
   */
  private static getRecommendation(
    similarity: number, 
    reasons: DuplicateReason[], 
    profile1: ProfileIdentifier, 
    profile2: ProfileIdentifier
  ): 'merge' | 'investigate' | 'keep_separate' {
    
    // High confidence matches should be investigated for merging
    if (similarity >= 85) {
      return 'merge';
    }
    
    // Medium confidence matches need investigation
    if (similarity >= 60) {
      return 'investigate';
    }
    
    // Check for verification status mismatch (might be impersonation)
    if (profile1.isVerified !== profile2.isVerified) {
      return 'investigate';
    }
    
    return 'keep_separate';
  }

  /**
   * Find similar profiles to a given profile
   */
  static findSimilarProfiles(targetProfile: ProfileIdentifier, profiles: ProfileIdentifier[]): DuplicateMatch[] {
    const matches: DuplicateMatch[] = [];
    
    profiles.forEach(profile => {
      if (profile.id === targetProfile.id) {
        return; // Skip self
      }
      
      const match = this.compareProfiles(targetProfile, profile);
      if (match.similarity >= 30) {
        matches.push(match);
      }
    });
    
    return matches.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Get duplicate detection statistics
   */
  static getDuplicateStats(matches: DuplicateMatch[]): {
    totalMatches: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    recommendMerge: number;
    commonReasons: Record<string, number>;
  } {
    const stats = {
      totalMatches: matches.length,
      highConfidence: matches.filter(m => m.confidence === 'high').length,
      mediumConfidence: matches.filter(m => m.confidence === 'medium').length,
      lowConfidence: matches.filter(m => m.confidence === 'low').length,
      recommendMerge: matches.filter(m => m.recommendation === 'merge').length,
      commonReasons: {} as Record<string, number>
    };

    // Count common duplicate reasons
    matches.forEach(match => {
      match.reasons.forEach(reason => {
        const key = `${reason.field} (${reason.type})`;
        stats.commonReasons[key] = (stats.commonReasons[key] || 0) + 1;
      });
    });

    return stats;
  }
} 