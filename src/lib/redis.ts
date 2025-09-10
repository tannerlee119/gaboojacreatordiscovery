import Redis from 'ioredis';

// Redis connection configuration
const redisConfig = {
  // Use Redis URL from environment or default to localhost
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  
  // Connection options optimized for Vercel serverless
  maxRetriesPerRequest: 2, // Reduce retries for faster failures
  retryDelayOnFailover: 50, // Faster retry
  lazyConnect: true,
  
  // Shorter timeouts for serverless environment
  connectTimeout: 5000, // 5 seconds
  commandTimeout: 3000, // 3 seconds
  
  // Serverless optimizations
  enableReadyCheck: false,
  maxmemoryPolicy: 'allkeys-lru',
};

// Create Redis client instance
export const redis = process.env.REDIS_URL 
  ? new Redis(process.env.REDIS_URL)
  : new Redis(redisConfig);

// Connection event handlers
redis.on('connect', () => {
  console.log('🔗 Redis connected successfully');
});

redis.on('error', (error) => {
  console.error('❌ Redis connection error:', error.message);
});

redis.on('ready', () => {
  console.log('✅ Redis client ready');
});

redis.on('close', () => {
  console.log('🔌 Redis connection closed');
});

// Helper function to safely execute Redis operations with fallback
export async function safeRedisOperation<T>(
  operation: () => Promise<T>,
  fallback: T,
  operationName: string = 'Redis operation'
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`❌ ${operationName} failed:`, error);
    return fallback;
  }
}

// Test Redis connection
export async function testRedisConnection(): Promise<boolean> {
  try {
    await redis.ping();
    console.log('✅ Redis connection test successful');
    return true;
  } catch (error) {
    console.error('❌ Redis connection test failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function closeRedis(): Promise<void> {
  try {
    await redis.quit();
    console.log('✅ Redis connection closed gracefully');
  } catch (error) {
    console.error('❌ Error closing Redis connection:', error);
  }
}

// Export Redis instance as default
export default redis;