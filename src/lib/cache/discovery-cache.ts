import crypto from 'crypto';
import { redis, safeRedisOperation } from '@/lib/redis';

// Cache TTL constants (in seconds)
const CACHE_TTL = {
  COMPLETE_RESULTS: 300,    // 5 minutes - complete discovery results
  CREATOR_DATA: 1800,       // 30 minutes - individual creator data  
  FILTER_COUNTS: 600,       // 10 minutes - pagination counts
  GROWTH_DATA: 3600,        // 1 hour - growth calculations
} as const;

// Discovery filters interface
export interface DiscoveryFilters {
  platform?: 'all' | 'instagram' | 'tiktok';
  category?: string[];
  minFollowers?: number;
  maxFollowers?: number;
  verified?: boolean;
  sortBy?: 'followers-desc' | 'followers-asc';
  page?: number;
  limit?: number;
}

// Growth data interface
export interface CreatorGrowthData {
  current_follower_count?: number;
  previous_follower_count?: number;
  growth_percentage?: number;
}

// Cache metrics interface
export interface CacheMetrics {
  hitRate: number;
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  averageResponseTime: number;
  memoryUsage: string;
}

export class DiscoveryCache {
  private static metricsKey = 'cache:metrics:discovery';
  
  /**
   * Generate consistent hash for filters
   */
  private static hashFilters(filters: DiscoveryFilters): string {
    // Create normalized filter object for consistent hashing
    const normalized = {
      platform: filters.platform || 'all',
      category: filters.category?.sort() || [],
      minFollowers: filters.minFollowers || 0,
      maxFollowers: filters.maxFollowers || 10000000,
      verified: filters.verified,
      sortBy: filters.sortBy || 'followers-desc',
      limit: filters.limit || 12
    };
    
    return crypto.createHash('md5')
      .update(JSON.stringify(normalized))
      .digest('hex');
  }

  /**
   * Get cached complete discovery results
   */
  static async getCachedResults(filters: DiscoveryFilters, page: number = 1): Promise<unknown | null> {
    const filterHash = this.hashFilters(filters);
    const key = `discovery:results:${filterHash}:${page}`;
    
    return safeRedisOperation(
      async () => {
        const startTime = Date.now();
        const cached = await redis.get(key);
        const responseTime = Date.now() - startTime;
        
        if (cached) {
          console.log(`🚀 Cache HIT for discovery results: ${filterHash.substring(0, 8)}... (page ${page}) - ${responseTime}ms`);
          await this.recordCacheHit(responseTime);
          return JSON.parse(cached);
        } else {
          await this.recordCacheMiss();
          return null;
        }
      },
      null,
      'Get cached discovery results'
    );
  }

  /**
   * Cache complete discovery results
   */
  static async cacheResults(filters: DiscoveryFilters, page: number, data: unknown): Promise<void> {
    const filterHash = this.hashFilters(filters);
    const key = `discovery:results:${filterHash}:${page}`;
    
    await safeRedisOperation(
      async () => {
        await redis.setex(key, CACHE_TTL.COMPLETE_RESULTS, JSON.stringify(data));
        console.log(`💾 Cached discovery results: ${filterHash.substring(0, 8)}... (page ${page}) - TTL: ${CACHE_TTL.COMPLETE_RESULTS}s`);
      },
      undefined,
      'Cache discovery results'
    );
  }

  /**
   * Get cached creator growth data
   */
  static async getCreatorGrowthData(creatorId: string): Promise<CreatorGrowthData | null> {
    const key = `growth:${creatorId}`;
    
    return safeRedisOperation(
      async () => {
        const cached = await redis.get(key);
        if (cached) {
          console.log(`📈 Cache HIT for growth data: ${creatorId}`);
          return JSON.parse(cached);
        }
        return null;
      },
      null,
      'Get creator growth data'
    );
  }

  /**
   * Cache creator growth data
   */
  static async cacheCreatorGrowthData(creatorId: string, growthData: CreatorGrowthData): Promise<void> {
    const key = `growth:${creatorId}`;
    
    await safeRedisOperation(
      async () => {
        await redis.setex(key, CACHE_TTL.GROWTH_DATA, JSON.stringify(growthData));
        console.log(`💾 Cached growth data for creator: ${creatorId} - TTL: ${CACHE_TTL.GROWTH_DATA}s`);
      },
      undefined,
      'Cache creator growth data'
    );
  }

  /**
   * Get cached filter count for pagination
   */
  static async getCachedFilterCount(filters: DiscoveryFilters): Promise<number | null> {
    const filterHash = this.hashFilters(filters);
    const key = `discovery:count:${filterHash}`;
    
    return safeRedisOperation(
      async () => {
        const cached = await redis.get(key);
        if (cached) {
          console.log(`🔢 Cache HIT for filter count: ${filterHash.substring(0, 8)}...`);
          return parseInt(cached, 10);
        }
        return null;
      },
      null,
      'Get cached filter count'
    );
  }

  /**
   * Cache filter count for pagination
   */
  static async cacheFilterCount(filters: DiscoveryFilters, count: number): Promise<void> {
    const filterHash = this.hashFilters(filters);
    const key = `discovery:count:${filterHash}`;
    
    await safeRedisOperation(
      async () => {
        await redis.setex(key, CACHE_TTL.FILTER_COUNTS, count.toString());
        console.log(`💾 Cached filter count: ${filterHash.substring(0, 8)}... = ${count} - TTL: ${CACHE_TTL.FILTER_COUNTS}s`);
      },
      undefined,
      'Cache filter count'
    );
  }

  /**
   * Invalidate all cached results when creator data changes
   */
  static async invalidateCreatorCache(creatorId: string): Promise<void> {
    await safeRedisOperation(
      async () => {
        // Get all discovery result keys
        const discoveryKeys = await redis.keys('discovery:results:*');
        const countKeys = await redis.keys('discovery:count:*');
        const growthKey = `growth:${creatorId}`;
        
        // Delete all related keys
        const allKeys = [...discoveryKeys, ...countKeys, growthKey];
        if (allKeys.length > 0) {
          await redis.del(...allKeys);
          console.log(`🧹 Invalidated ${allKeys.length} cache keys for creator: ${creatorId}`);
        }
      },
      undefined,
      'Invalidate creator cache'
    );
  }

  /**
   * Smart invalidation - only clear affected platform caches
   */
  static async invalidateByPlatform(platform: 'instagram' | 'tiktok'): Promise<void> {
    await safeRedisOperation(
      async () => {
        const allKeys = await redis.keys('discovery:*');
        
        // Filter keys that might be affected by this platform
        // For now, we'll invalidate all discovery caches as platform filters can affect results
        // In the future, we could parse the filter hash to be more selective
        if (allKeys.length > 0) {
          await redis.del(...allKeys);
          console.log(`🧹 Invalidated ${allKeys.length} platform cache keys for: ${platform}`);
        }
      },
      undefined,
      'Invalidate platform cache'
    );
  }

  /**
   * Clear all discovery caches (admin function)
   */
  static async clearAllCaches(): Promise<void> {
    await safeRedisOperation(
      async () => {
        const allKeys = await redis.keys('discovery:*');
        const growthKeys = await redis.keys('growth:*');
        
        const totalKeys = [...allKeys, ...growthKeys];
        if (totalKeys.length > 0) {
          await redis.del(...totalKeys);
          console.log(`🧹 Cleared all ${totalKeys.length} discovery cache keys`);
        }
      },
      undefined,
      'Clear all caches'
    );
  }

  /**
   * Record cache hit for metrics
   */
  private static async recordCacheHit(responseTime: number): Promise<void> {
    await safeRedisOperation(
      async () => {
        await redis.hincrby(this.metricsKey, 'totalRequests', 1);
        await redis.hincrby(this.metricsKey, 'cacheHits', 1);
        await redis.hset(this.metricsKey, 'lastResponseTime', responseTime);
      },
      undefined,
      'Record cache hit'
    );
  }

  /**
   * Record cache miss for metrics
   */
  private static async recordCacheMiss(): Promise<void> {
    await safeRedisOperation(
      async () => {
        await redis.hincrby(this.metricsKey, 'totalRequests', 1);
        await redis.hincrby(this.metricsKey, 'cacheMisses', 1);
      },
      undefined,
      'Record cache miss'
    );
  }

  /**
   * Get cache performance metrics
   */
  static async getMetrics(): Promise<CacheMetrics> {
    return safeRedisOperation(
      async () => {
        const metrics = await redis.hmget(
          this.metricsKey,
          'totalRequests', 
          'cacheHits', 
          'cacheMisses',
          'lastResponseTime'
        );

        const totalRequests = parseInt(metrics[0] || '0', 10);
        const cacheHits = parseInt(metrics[1] || '0', 10);
        const cacheMisses = parseInt(metrics[2] || '0', 10);
        const lastResponseTime = parseInt(metrics[3] || '0', 10);

        const hitRate = totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0;

        // Get memory usage info
        const memoryInfo = await redis.memory('USAGE', this.metricsKey);
        
        return {
          hitRate: Math.round(hitRate * 100) / 100,
          totalRequests,
          cacheHits,
          cacheMisses,
          averageResponseTime: lastResponseTime,
          memoryUsage: memoryInfo ? `${(memoryInfo / 1024).toFixed(2)} KB` : 'N/A'
        };
      },
      {
        hitRate: 0,
        totalRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        averageResponseTime: 0,
        memoryUsage: 'N/A'
      },
      'Get cache metrics'
    );
  }

  /**
   * Reset cache metrics (admin function)
   */
  static async resetMetrics(): Promise<void> {
    await safeRedisOperation(
      async () => {
        await redis.del(this.metricsKey);
        console.log('🧹 Reset cache metrics');
      },
      undefined,
      'Reset cache metrics'
    );
  }
}