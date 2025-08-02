import { z } from 'zod';

// Base validation utilities
const nonEmptyString = z.string().min(1).trim();
const positiveNumber = z.number().positive();
const nonNegativeNumber = z.number().min(0);
const optionalUrl = z.string().url().optional().or(z.literal(''));
const optionalString = z.string().optional();

// Platform enum
export const platformSchema = z.enum(['instagram', 'tiktok', 'youtube']);

// Creator category enum
export const creatorCategorySchema = z.enum([
  'lifestyle', 'fashion', 'beauty', 'fitness', 'food', 'travel',
  'tech', 'gaming', 'music', 'comedy', 'education', 'business',
  'art', 'pets', 'family', 'other'
]);

// Username validation with platform-specific rules
export const usernameSchema = z.string()
  .min(1, 'Username is required')
  .max(30, 'Username too long')
  .regex(/^[a-zA-Z0-9._]+$/, 'Invalid username format')
  .transform(val => val.toLowerCase().trim());

// Follower count validation with reasonable limits
export const followerCountSchema = z.number()
  .int('Follower count must be integer')
  .min(0, 'Follower count cannot be negative')
  .max(1_000_000_000, 'Follower count unreasonably high');

// Engagement rate validation (0-100%)
export const engagementRateSchema = z.number()
  .min(0, 'Engagement rate cannot be negative')
  .max(100, 'Engagement rate cannot exceed 100%');

// Instagram-specific schemas
export const instagramPostSchema = z.object({
  id: nonEmptyString,
  imageUrl: optionalUrl,
  caption: optionalString,
  likes: nonNegativeNumber,
  comments: nonNegativeNumber,
  timestamp: z.date(),
  type: z.enum(['image', 'video', 'carousel'])
});

export const instagramMetricsSchema = z.object({
  followerCount: followerCountSchema,
  followingCount: followerCountSchema,
  postCount: nonNegativeNumber,
  averageLikes: nonNegativeNumber,
  averageComments: nonNegativeNumber,
  engagementRate: engagementRateSchema,
  recentPosts: z.array(instagramPostSchema).optional()
});

// TikTok-specific schemas
export const tiktokVideoSchema = z.object({
  id: nonEmptyString,
  thumbnailUrl: optionalUrl,
  description: optionalString,
  views: nonNegativeNumber,
  likes: nonNegativeNumber,
  comments: nonNegativeNumber,
  shares: nonNegativeNumber,
  timestamp: z.date(),
  duration: positiveNumber
});

export const tiktokMetricsSchema = z.object({
  followerCount: followerCountSchema,
  followingCount: followerCountSchema,
  likeCount: nonNegativeNumber,
  videoCount: nonNegativeNumber,
  averageViews: nonNegativeNumber,
  averageLikes: nonNegativeNumber,
  engagementRate: engagementRateSchema,
  recentVideos: z.array(tiktokVideoSchema).optional()
});

// YouTube-specific schemas
export const youtubeVideoSchema = z.object({
  id: nonEmptyString,
  title: nonEmptyString,
  thumbnailUrl: optionalUrl,
  description: optionalString,
  views: nonNegativeNumber,
  likes: nonNegativeNumber,
  comments: nonNegativeNumber,
  timestamp: z.date(),
  duration: z.number().nullable()
});

export const youtubeMetricsSchema = z.object({
  subscriberCount: followerCountSchema,
  videoCount: nonNegativeNumber,
  viewCount: nonNegativeNumber,
  averageViews: nonNegativeNumber,
  averageLikes: nonNegativeNumber,
  averageComments: nonNegativeNumber,
  engagementRate: engagementRateSchema,
  recentVideos: z.array(youtubeVideoSchema).optional()
});

// Main creator profile schema
export const creatorProfileSchema = z.object({
  username: usernameSchema,
  platform: platformSchema,
  displayName: nonEmptyString.max(100, 'Display name too long'),
  bio: z.string().max(500, 'Bio too long').optional(),
  profileImageUrl: optionalUrl,
  isVerified: z.boolean(),
  location: z.string().max(100, 'Location too long').optional(),
  website: optionalUrl,
  email: z.string().email('Invalid email').optional(),
  
  // Platform-specific metrics (only one should be present)
  instagramMetrics: instagramMetricsSchema.optional(),
  tiktokMetrics: tiktokMetricsSchema.optional(),
  youtubeMetrics: youtubeMetricsSchema.optional(),
  
  // AI analysis data
  aiAnalysis: z.record(z.string(), z.unknown()).optional(),
  aiSummary: z.object({
    creator_score: z.string(),
    niche: z.string(),
    brand_potential: z.string(),
    key_strengths: z.string()
  }).optional()
});

// Scraped data schema (what comes from scrapers before processing)
export const scrapedDataSchema = z.object({
  username: z.string(),
  platform: z.string(),
  displayName: z.string().optional(),
  bio: z.string().optional(),
  profileImageUrl: z.string().optional(),
  isVerified: z.boolean().optional(),
  followerCount: z.number().optional(),
  followingCount: z.number().optional(),
  location: z.string().optional(),
  website: z.string().optional(),
  metrics: z.record(z.string(), z.unknown()).optional(),
  screenshot: z.instanceof(Buffer).optional()
});

// Data quality validation result
export const validationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.object({
    field: z.string(),
    message: z.string(),
    severity: z.enum(['error', 'warning', 'info'])
  })),
  warnings: z.array(z.string()),
  qualityScore: z.number().min(0).max(100),
  completenessScore: z.number().min(0).max(100),
  consistencyScore: z.number().min(0).max(100)
});

// Type exports
export type ScrapedData = z.infer<typeof scrapedDataSchema>;
export type ValidationResult = z.infer<typeof validationResultSchema>;
export type CreatorProfileValidated = z.infer<typeof creatorProfileSchema>;
export type InstagramMetrics = z.infer<typeof instagramMetricsSchema>;
export type TikTokMetrics = z.infer<typeof tiktokMetricsSchema>;
export type YouTubeMetrics = z.infer<typeof youtubeMetricsSchema>; 