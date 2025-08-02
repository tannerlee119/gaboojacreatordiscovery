interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Check if a request is allowed for the given identifier
   */
  isAllowed(identifier: string): { allowed: boolean; resetTime?: number; remainingRequests?: number } {
    const now = Date.now();
    const entry = this.store.get(identifier);

    // If no entry exists or entry has expired, create new one
    if (!entry || now >= entry.resetTime) {
      this.store.set(identifier, {
        count: 1,
        resetTime: now + this.config.windowMs
      });
      
      return {
        allowed: true,
        remainingRequests: this.config.maxRequests - 1,
        resetTime: now + this.config.windowMs
      };
    }

    // If within rate limit, increment counter
    if (entry.count < this.config.maxRequests) {
      entry.count++;
      return {
        allowed: true,
        remainingRequests: this.config.maxRequests - entry.count,
        resetTime: entry.resetTime
      };
    }

    // Rate limit exceeded
    return {
      allowed: false,
      resetTime: entry.resetTime,
      remainingRequests: 0
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Get current status for identifier
   */
  getStatus(identifier: string): { count: number; resetTime: number } | null {
    return this.store.get(identifier) || null;
  }

  /**
   * Reset rate limit for identifier (admin function)
   */
  reset(identifier: string): void {
    this.store.delete(identifier);
  }
}

// Create rate limiter instances for different endpoints
export const apiRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10 // 10 requests per 15 minutes per IP
});

export const strictRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 2 // 2 requests per minute per IP
});

/**
 * Get client identifier for rate limiting
 */
export function getClientIdentifier(request: Request): string {
  // Try to get real IP from headers (for proxies)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  // Use the first available IP
  const ip = forwarded?.split(',')[0] || realIp || cfConnectingIp || 'unknown';
  
  return ip.trim();
} 