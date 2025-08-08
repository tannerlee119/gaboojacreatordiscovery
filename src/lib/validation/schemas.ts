import { z } from 'zod';

// Username validation schema - prevents injection and ensures valid social media usernames
export const usernameSchema = z
  .string()
  .min(1, 'Username is required')
  .max(30, 'Username must be 30 characters or less')
  .regex(/^[a-zA-Z0-9._]+$/, 'Username can only contain letters, numbers, dots, and underscores')
  .transform((val) => val.toLowerCase().trim());

// Platform validation schema
export const platformSchema = z.enum(['instagram', 'tiktok', 'youtube'] as const);

// Creator analysis request schema
export const analyzeCreatorRequestSchema = z.object({
  username: usernameSchema,
  platform: platformSchema,
  forceRefresh: z.boolean().optional().default(false),
});

// Input sanitization utilities
export class InputSanitizer {
  /**
   * Sanitize string input to prevent XSS attacks
   */
  static sanitizeString(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove HTML brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Sanitize URL input
   */
  static sanitizeUrl(url: string): string | null {
    try {
      const parsed = new URL(url);
      // Only allow HTTP/HTTPS protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return null;
      }
      return parsed.toString();
    } catch {
      return null;
    }
  }

  /**
   * Sanitize profile data to prevent XSS
   */
  static sanitizeProfileData(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...data };
    
    // Sanitize username field
    if (typeof sanitized.username === 'string') {
      sanitized.username = this.sanitizeString(sanitized.username);
    }
    
    // Sanitize string fields
    if (typeof sanitized.displayName === 'string') {
      sanitized.displayName = this.sanitizeString(sanitized.displayName);
    }
    
    if (typeof sanitized.bio === 'string') {
      sanitized.bio = this.sanitizeString(sanitized.bio);
    }
    
    if (typeof sanitized.location === 'string') {
      sanitized.location = this.sanitizeString(sanitized.location);
    }
    
    // Sanitize URL fields
    if (typeof sanitized.website === 'string') {
      sanitized.website = this.sanitizeUrl(sanitized.website);
    }
    
    if (typeof sanitized.profileImageUrl === 'string') {
      sanitized.profileImageUrl = this.sanitizeUrl(sanitized.profileImageUrl);
    }
    
    return sanitized;
  }
}

// Rate limiting validation
export const rateLimitSchema = z.object({
  ip: z.string().regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/, 'Invalid IP address'),
  userAgent: z.string().max(500),
  timestamp: z.number(),
});

export type AnalyzeCreatorRequest = z.infer<typeof analyzeCreatorRequestSchema>;
export type RateLimitData = z.infer<typeof rateLimitSchema>; 