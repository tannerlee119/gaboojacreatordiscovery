import { supabase } from '@/lib/supabase';

export interface CreatorProfile {
  username: string;
  platform: 'instagram' | 'tiktok';
  displayName: string;
  bio?: string;
  profileImageUrl?: string;
  website?: string;
  location?: string;
  followerCount: number;
  followingCount: number;
  isVerified: boolean;
  aiAnalysis?: {
    content_style: string;
    audience_demographics: string;
    category: string;
  };
}

export interface MatchingFactor {
  signal: string;
  confidence: number;
  details: string;
}

export interface CreatorMatch {
  username: string;
  platform: 'instagram' | 'tiktok';
  displayName: string;
  profileImageUrl?: string;
  confidence: number;
  matchingFactors: MatchingFactor[];
}

export interface CreatorMatchingResult {
  totalConfidence: number;
  matchingSignals: string[];
  potentialMatches: CreatorMatch[];
  suggestedMatch?: CreatorMatch; // Best match if confidence > threshold
}

export class CreatorMatchingService {
  private static readonly CONFIDENCE_THRESHOLD = 75; // Minimum confidence for suggested match
  private static readonly MAX_MATCHES = 5; // Maximum potential matches to return

  /**
   * Find potential cross-platform matches for a creator
   */
  static async findPotentialMatches(
    targetCreator: CreatorProfile
  ): Promise<CreatorMatchingResult> {
    console.log(`🔍 Finding matches for ${targetCreator.platform}/@${targetCreator.username}`);

    // Get all creators from the opposite platform
    const oppositePlatform = targetCreator.platform === 'instagram' ? 'tiktok' : 'instagram';
    
    const { data: candidates, error } = await supabase
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
      .eq('platform', oppositePlatform)
      .order('follower_count', { ascending: false })
      .limit(100); // Limit for performance

    if (error || !candidates) {
      console.error('Error fetching candidate creators:', error);
      return {
        totalConfidence: 0,
        matchingSignals: [],
        potentialMatches: []
      };
    }

    console.log(`📊 Analyzing ${candidates.length} ${oppositePlatform} creators`);

    // Score each candidate
    const scoredMatches: CreatorMatch[] = [];

    for (const candidate of candidates) {
      const candidateProfile: CreatorProfile = {
        username: candidate.username,
        platform: candidate.platform as 'instagram' | 'tiktok',
        displayName: candidate.display_name || candidate.username,
        bio: candidate.bio,
        profileImageUrl: candidate.profile_image_url,
        website: candidate.website,
        location: candidate.location,
        followerCount: candidate.follower_count || 0,
        followingCount: candidate.following_count || 0,
        isVerified: candidate.is_verified || false,
        aiAnalysis: {
          content_style: candidate.ai_content_style || '',
          audience_demographics: candidate.ai_audience_demographics || '',
          category: candidate.category || ''
        }
      };

      const matchScore = this.calculateMatchScore(targetCreator, candidateProfile);
      
      if (matchScore.confidence > 20) { // Only include matches with some confidence
        scoredMatches.push({
          username: candidate.username,
          platform: candidate.platform as 'instagram' | 'tiktok',
          displayName: candidate.display_name || candidate.username,
          profileImageUrl: candidate.profile_image_url,
          confidence: matchScore.confidence,
          matchingFactors: matchScore.factors
        });
      }
    }

    // Sort by confidence and take top matches
    scoredMatches.sort((a, b) => b.confidence - a.confidence);
    const topMatches = scoredMatches.slice(0, this.MAX_MATCHES);

    const bestMatch = topMatches[0];
    const result: CreatorMatchingResult = {
      totalConfidence: bestMatch?.confidence || 0,
      matchingSignals: bestMatch?.matchingFactors.map(f => f.signal) || [],
      potentialMatches: topMatches,
      suggestedMatch: bestMatch?.confidence >= this.CONFIDENCE_THRESHOLD ? bestMatch : undefined
    };

    console.log(`✅ Found ${topMatches.length} potential matches, best confidence: ${result.totalConfidence}%`);
    
    return result;
  }

  /**
   * Calculate match score between two creator profiles
   */
  private static calculateMatchScore(
    creator1: CreatorProfile, 
    creator2: CreatorProfile
  ): { confidence: number; factors: MatchingFactor[] } {
    const factors: MatchingFactor[] = [];
    let totalScore = 0;

    // 1. Display Name Match (High confidence signal)
    const displayNameSimilarity = this.calculateStringSimilarity(
      creator1.displayName.toLowerCase(),
      creator2.displayName.toLowerCase()
    );
    
    if (displayNameSimilarity > 0.8) {
      const confidence = Math.round(displayNameSimilarity * 90);
      factors.push({
        signal: 'Display Name Match',
        confidence,
        details: `"${creator1.displayName}" vs "${creator2.displayName}"`
      });
      totalScore += confidence * 0.3; // 30% weight
    }

    // 2. Username Similarity (Medium confidence)
    const usernameSimilarity = this.calculateStringSimilarity(
      creator1.username.toLowerCase(),
      creator2.username.toLowerCase()
    );
    
    if (usernameSimilarity > 0.5) {
      const confidence = Math.round(usernameSimilarity * 70);
      factors.push({
        signal: 'Username Similarity',
        confidence,
        details: `@${creator1.username} vs @${creator2.username}`
      });
      totalScore += confidence * 0.15; // 15% weight
    }

    // 3. Bio/Description Similarity (High confidence signal)
    if (creator1.bio && creator2.bio) {
      const bioSimilarity = this.calculateStringSimilarity(
        creator1.bio.toLowerCase(),
        creator2.bio.toLowerCase()
      );
      
      if (bioSimilarity > 0.3) {
        const confidence = Math.round(bioSimilarity * 85);
        factors.push({
          signal: 'Bio Similarity',
          confidence,
          details: `Similar bio content detected`
        });
        totalScore += confidence * 0.25; // 25% weight
      }
    }

    // 4. Website/Link Match (Very high confidence signal)
    if (creator1.website && creator2.website) {
      const websiteSimilarity = this.normalizeUrl(creator1.website) === this.normalizeUrl(creator2.website);
      
      if (websiteSimilarity) {
        factors.push({
          signal: 'Website Match',
          confidence: 95,
          details: `Both link to: ${this.normalizeUrl(creator1.website)}`
        });
        totalScore += 95 * 0.35; // 35% weight - very strong signal
      }
    }

    // 5. Location Match (Medium confidence)
    if (creator1.location && creator2.location) {
      const locationSimilarity = this.calculateStringSimilarity(
        creator1.location.toLowerCase(),
        creator2.location.toLowerCase()
      );
      
      if (locationSimilarity > 0.7) {
        const confidence = Math.round(locationSimilarity * 60);
        factors.push({
          signal: 'Location Match',
          confidence,
          details: `${creator1.location} vs ${creator2.location}`
        });
        totalScore += confidence * 0.1; // 10% weight
      }
    }

    // 6. Follower Count Correlation (Supporting signal)
    const followerRatio = Math.min(creator1.followerCount, creator2.followerCount) / 
                         Math.max(creator1.followerCount, creator2.followerCount);
    
    if (followerRatio > 0.1) { // Within an order of magnitude
      const confidence = Math.round(followerRatio * 40);
      factors.push({
        signal: 'Follower Count Correlation',
        confidence,
        details: `${creator1.followerCount.toLocaleString()} vs ${creator2.followerCount.toLocaleString()}`
      });
      totalScore += confidence * 0.05; // 5% weight
    }

    // 7. Content Style Match (AI Analysis)
    if (creator1.aiAnalysis?.content_style && creator2.aiAnalysis?.content_style) {
      const styleSimilarity = this.calculateStringSimilarity(
        creator1.aiAnalysis.content_style.toLowerCase(),
        creator2.aiAnalysis.content_style.toLowerCase()
      );
      
      if (styleSimilarity > 0.4) {
        const confidence = Math.round(styleSimilarity * 70);
        factors.push({
          signal: 'Content Style Match',
          confidence,
          details: 'Similar content style detected by AI'
        });
        totalScore += confidence * 0.1; // 10% weight
      }
    }

    // 8. Category Match (Supporting signal)
    if (creator1.aiAnalysis?.category && creator2.aiAnalysis?.category) {
      if (creator1.aiAnalysis.category === creator2.aiAnalysis.category) {
        factors.push({
          signal: 'Category Match',
          confidence: 50,
          details: `Both in ${creator1.aiAnalysis.category} category`
        });
        totalScore += 50 * 0.05; // 5% weight
      }
    }

    return {
      confidence: Math.min(Math.round(totalScore), 100), // Cap at 100%
      factors
    };
  }

  /**
   * Calculate string similarity using Jaccard similarity
   */
  private static calculateStringSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;

    // Simple Jaccard similarity with word-level tokens
    const tokens1 = new Set(str1.split(/\s+/));
    const tokens2 = new Set(str2.split(/\s+/));
    
    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);
    
    return intersection.size / union.size;
  }

  /**
   * Normalize URL for comparison
   */
  private static normalizeUrl(url: string): string {
    return url
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');
  }

  /**
   * Get existing matches from database (for caching results)
   */
  static async getExistingMatches(
    _username: string, 
    _platform: 'instagram' | 'tiktok'
  ): Promise<CreatorMatch[]> {
    // This would query a creator_matches table if we implement caching
    // For now, return empty array
    return [];
  }

  /**
   * Save match results to database (for caching and manual verification)
   */
  static async saveMatchResults(
    username: string,
    platform: 'instagram' | 'tiktok',
    matches: CreatorMatchingResult
  ): Promise<void> {
    // This would save to a creator_matches table for caching
    console.log(`💾 Would save ${matches.potentialMatches.length} matches for ${platform}/@${username}`);
  }
}