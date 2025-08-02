import { Platform } from '@/lib/types';

export interface AnalysisComplexity {
  level: 'basic' | 'standard' | 'premium';
  factors: {
    followerCount: number;
    hasVerification: boolean;
    hasWebsite: boolean;
    platformImportance: number;
  };
}

export interface ModelConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  imageDetail: 'low' | 'high';
  estimatedCostUSD: number;
}

export interface CacheKey {
  username: string;
  platform: Platform;
  screenshotHash: string;
  analysisLevel: string;
}

interface CacheEntry {
  analysis: Record<string, unknown>;
  timestamp: number;
  cost: number;
}

export class AICostOptimizer {
  private static cache = new Map<string, CacheEntry>();

  private static readonly CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
  private static readonly MAX_CACHE_SIZE = 1000; // Limit cache size

  /**
   * Determine analysis complexity based on profile factors
   */
  static determineComplexity(factors: AnalysisComplexity['factors']): AnalysisComplexity {
    const { followerCount, hasVerification, hasWebsite } = factors;
    
    let score = 0;
    
    // Enhanced follower count scoring - medium accounts (40K+) get better models
    if (followerCount > 1000000) score += 4; // 1M+ followers - premium
    else if (followerCount > 100000) score += 3; // 100K+ followers - premium
    else if (followerCount > 40000) score += 2; // 40K+ followers - standard with GPT-4o
    else if (followerCount > 10000) score += 1; // 10K+ followers - standard
    else if (followerCount < 5000) score += 2; // VERY small accounts need richer analysis
    
    // Verification adds importance
    if (hasVerification) score += 2;
    
    // Website suggests business potential
    if (hasWebsite) score += 1;
    
    // Platform importance
    score += factors.platformImportance;

    // Determine complexity level - adjusted thresholds
    let level: AnalysisComplexity['level'];
    if (score >= 6) level = 'premium';
    else if (score >= 4) level = 'standard'; // Lowered threshold for standard
    else level = 'basic';

    return { level, factors };
  }

  /**
   * Get optimal model configuration based on complexity
   */
  static getModelConfig(complexity: AnalysisComplexity): ModelConfig {
    switch (complexity.level) {
      case 'basic':
        return {
          model: 'gpt-4o-mini',
          maxTokens: 500,
          temperature: 0.3,
          imageDetail: 'low',
          estimatedCostUSD: 0.003 // Approximate cost
        };
      
      case 'standard':
        return {
          model: 'gpt-4o', // Upgraded to GPT-4o for better analysis
          maxTokens: 800,
          temperature: 0.3,
          imageDetail: 'high', // Better image analysis
          estimatedCostUSD: 0.025 // Higher cost but better quality
        };
      
      case 'premium':
        return {
          model: 'gpt-4o',
          maxTokens: 1000,
          temperature: 0.3,
          imageDetail: 'high',
          estimatedCostUSD: 0.05 // Approximate cost
        };
    }
  }

  /**
   * Generate cache key for analysis
   */
  static generateCacheKey(
    username: string,
    platform: Platform,
    screenshotHash: string,
    complexity: AnalysisComplexity
  ): string {
    return `${platform}:${username}:${screenshotHash}:${complexity.level}`;
  }

  /**
   * Get cached analysis if available
   */
  static getCachedAnalysis(cacheKey: string): { analysis: Record<string, unknown>; cost: number } | null {
    const cached = this.cache.get(cacheKey);
    
    if (!cached) return null;
    
    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.CACHE_DURATION) {
      this.cache.delete(cacheKey);
      return null;
    }
    
    console.log(`📦 Using cached AI analysis for key: ${cacheKey.substring(0, 50)}...`);
    return { analysis: cached.analysis, cost: 0 }; // No cost for cached results
  }

  /**
   * Cache analysis result
   */
  static cacheAnalysis(cacheKey: string, analysis: Record<string, unknown>, cost: number): void {
    // Implement LRU-style cache management
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entries
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Remove oldest 10% of entries
      const toRemove = Math.floor(this.MAX_CACHE_SIZE * 0.1);
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
    
    this.cache.set(cacheKey, {
      analysis,
      timestamp: Date.now(),
      cost
    });
    
    console.log(`💾 Cached AI analysis. Cache size: ${this.cache.size}`);
  }

  /**
   * Optimize screenshot for AI analysis
   */
  static optimizeScreenshot(screenshot: Buffer, complexity: AnalysisComplexity): Buffer {
    // For basic analysis, we could implement image compression here
    // For now, return original buffer but log the optimization opportunity
    
    const originalSize = screenshot.length;
    
    if (complexity.level === 'basic') {
      console.log(`📷 Screenshot optimization opportunity: ${(originalSize / 1024).toFixed(1)}KB could be compressed for basic analysis`);
    }
    
    return screenshot;
  }

  /**
   * Generate screenshot hash for caching
   */
  static generateScreenshotHash(screenshot: Buffer): string {
    // Simple hash based on buffer length and first/last bytes
    const firstBytes = screenshot.subarray(0, 16);
    const lastBytes = screenshot.subarray(-16);
    const combined = Buffer.concat([firstBytes, lastBytes, Buffer.from([screenshot.length % 256])]);
    
    return combined.toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  /**
   * Get platform importance factor
   */
  static getPlatformImportance(platform: Platform): number {
    switch (platform) {
      case 'instagram': return 2; // High business value
      case 'tiktok': return 2; // High growth potential
      case 'youtube': return 3; // Highest monetization potential
      default: return 1;
    }
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    totalSavings: number;
  } {
    const totalEntries = this.cache.size;
    const savings = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.cost, 0);
    
    return {
      size: totalEntries,
      maxSize: this.MAX_CACHE_SIZE,
      hitRate: 0, // Would need to track hits/misses for accurate rate
      totalSavings: savings
    };
  }

  /**
   * Clear expired cache entries
   */
  static cleanupCache(): number {
    const before = this.cache.size;
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_DURATION) {
        this.cache.delete(key);
      }
    }
    
    const cleaned = before - this.cache.size;
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired cache entries`);
    }
    
    return cleaned;
  }
}

// Cleanup cache every hour
if (typeof window === 'undefined') { // Only run on server
  setInterval(() => {
    AICostOptimizer.cleanupCache();
  }, 60 * 60 * 1000);
} 