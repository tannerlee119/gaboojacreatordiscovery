import { NextResponse } from 'next/server';
import { AICostOptimizer } from '@/lib/ai-analysis/cost-optimizer';
import { setCorsHeaders } from '@/lib/security/cors';

interface CacheStats {
  size: number;
  maxSize: number;
  hitRate: number;
  totalSavings: number;
}

export async function GET() {
  try {
    // Get cache statistics
    const cacheStats = AICostOptimizer.getCacheStats();
    
    // Calculate cost savings metrics
    const metrics = {
      cache: {
        size: cacheStats.size,
        maxSize: cacheStats.maxSize,
        utilizationPercent: Math.round((cacheStats.size / cacheStats.maxSize) * 100),
        totalSavings: cacheStats.totalSavings,
        hitRate: cacheStats.hitRate
      },
      costOptimization: {
        modelsUsed: {
          'gpt-4o-mini': {
            name: 'GPT-4o Mini',
            costPerRequest: 0.003,
            usage: 'Basic analysis (small creators)'
          },
          'gpt-4o': {
            name: 'GPT-4o',
            costPerRequest: 0.05,
            usage: 'Premium analysis (large creators)'
          },
          'cached': {
            name: 'Cached Results',
            costPerRequest: 0.0,
            usage: 'Previously analyzed profiles'
          }
        },
        estimatedMonthlySavings: calculateMonthlySavings(cacheStats),
        optimizationTips: getOptimizationTips(cacheStats)
      },
      status: {
        cacheHealthy: cacheStats.size < cacheStats.maxSize * 0.9,
        lastCleanup: 'Running automatically every hour',
        recommendedActions: getRecommendedActions(cacheStats)
      }
    };

    const response = NextResponse.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });

    // Add caching headers for this metrics endpoint
    response.headers.set('Cache-Control', 'public, max-age=60'); // Cache for 1 minute
    
    return setCorsHeaders(response);

  } catch (error) {
    console.error('AI metrics error:', error);
    
    const response = NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve AI metrics' 
      },
      { status: 500 }
    );
    
    return setCorsHeaders(response);
  }
}

/**
 * Calculate estimated monthly savings from caching
 */
function calculateMonthlySavings(_cacheStats: CacheStats): number {
  // Assume average of 100 requests per day, 30% cache hit rate
  const dailyRequests = 100;
  const cacheHitRate = 0.3; // 30% estimated
  const averageCostPerRequest = 0.02; // Average between mini and full GPT-4o
  
  const dailySavings = dailyRequests * cacheHitRate * averageCostPerRequest;
  return Math.round(dailySavings * 30 * 100) / 100; // Monthly savings
}

/**
 * Get optimization tips based on cache performance
 */
function getOptimizationTips(cacheStats: CacheStats): string[] {
  const tips: string[] = [];
  
  if (cacheStats.size < cacheStats.maxSize * 0.3) {
    tips.push('Cache utilization is low - consider analyzing more profiles to build cache');
  }
  
  if (cacheStats.totalSavings < 10) {
    tips.push('Increase cache duration for frequently analyzed creators');
  }
  
  tips.push('Use basic analysis for creators with <10K followers to reduce costs');
  tips.push('Premium analysis is automatically used for verified accounts and 100K+ followers');
  
  return tips;
}

/**
 * Get recommended actions based on cache status
 */
function getRecommendedActions(cacheStats: CacheStats): string[] {
  const actions: string[] = [];
  
  if (cacheStats.size > cacheStats.maxSize * 0.8) {
    actions.push('Cache is getting full - cleanup will run automatically');
  }
  
  if (cacheStats.size === 0) {
    actions.push('Cache is empty - analyze some profiles to start building cost savings');
  } else {
    actions.push('Cache is healthy and saving costs on repeated analyses');
  }
  
  return actions;
} 