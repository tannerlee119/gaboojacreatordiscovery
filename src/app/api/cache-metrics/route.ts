import { NextRequest, NextResponse } from 'next/server';
import { DiscoveryCache } from '@/lib/cache/discovery-cache';
import { testRedisConnection } from '@/lib/redis';

// GET /api/cache-metrics - Get cache performance metrics
export async function GET(_request: NextRequest) {
  try {
    // Test Redis connection first
    const isRedisConnected = await testRedisConnection();
    
    if (!isRedisConnected) {
      return NextResponse.json({
        error: 'Redis not connected',
        metrics: null,
        status: 'disconnected'
      }, { status: 503 });
    }

    // Get cache metrics
    const metrics = await DiscoveryCache.getMetrics();
    
    const response = NextResponse.json({
      status: 'connected',
      metrics: {
        ...metrics,
        cacheStatus: metrics.hitRate > 50 ? 'healthy' : 'needs_warming',
        recommendations: getCacheRecommendations(metrics)
      },
      timestamp: new Date().toISOString()
    });

    // Cache the metrics endpoint response for 30 seconds
    response.headers.set('Cache-Control', 'public, max-age=30');
    
    return response;

  } catch (error) {
    console.error('Cache metrics error:', error);
    return NextResponse.json(
      { error: 'Failed to get cache metrics' },
      { status: 500 }
    );
  }
}

// POST /api/cache-metrics - Clear all discovery caches (admin function)
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'clear':
        await DiscoveryCache.clearAllCaches();
        return NextResponse.json({
          message: 'All discovery caches cleared successfully',
          timestamp: new Date().toISOString()
        });

      case 'reset-metrics':
        await DiscoveryCache.resetMetrics();
        return NextResponse.json({
          message: 'Cache metrics reset successfully',
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use ?action=clear or ?action=reset-metrics' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Cache management error:', error);
    return NextResponse.json(
      { error: 'Failed to perform cache operation' },
      { status: 500 }
    );
  }
}

/**
 * Get cache performance recommendations
 */
function getCacheRecommendations(metrics: {
  hitRate: number;
  totalRequests: number;
  averageResponseTime: number;
}): string[] {
  const recommendations: string[] = [];

  if (metrics.hitRate < 30) {
    recommendations.push('Cache hit rate is low - consider warming cache with popular filters');
  }

  if (metrics.totalRequests < 50) {
    recommendations.push('Low request volume - cache benefits will increase with usage');
  }

  if (metrics.hitRate > 80) {
    recommendations.push('Excellent cache performance - consider increasing TTL for stable data');
  }

  if (metrics.averageResponseTime > 100) {
    recommendations.push('High response times detected - check Redis connection and performance');
  }

  if (recommendations.length === 0) {
    recommendations.push('Cache is performing well - no immediate optimizations needed');
  }

  return recommendations;
}