// Core platform types
export type Platform = 'instagram' | 'tiktok' | 'youtube';

export type CreatorCategory = 
  | 'lifestyle'
  | 'fashion'
  | 'beauty'
  | 'fitness'
  | 'sports'
  | 'food'
  | 'travel'
  | 'tech'
  | 'gaming'
  | 'music'
  | 'comedy'
  | 'education'
  | 'business'
  | 'art'
  | 'pets'
  | 'family'
  | 'other';

// Platform-specific metrics
export interface InstagramMetrics {
  followerCount: number;
  followingCount: number;
  postCount: number;
  averageLikes: number;
  averageComments: number;
  engagementRate: number;
  recentPosts: InstagramPost[];
}

export interface TikTokMetrics {
  followerCount: number;
  followingCount: number;
  likeCount: number;
  videoCount: number;
  averageViews: number;
  averageLikes: number;
  engagementRate: number;
  recentVideos: TikTokVideo[];
}

export interface YouTubeMetrics {
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  averageViews: number;
  averageLikes: number;
  averageComments: number;
  engagementRate: number;
  recentVideos: YouTubeVideo[];
}

// Post/Video types
export interface InstagramPost {
  id: string;
  imageUrl: string;
  caption: string;
  likes: number;
  comments: number;
  timestamp: Date;
  type: 'image' | 'video' | 'carousel';
}

export interface TikTokVideo {
  id: string;
  thumbnailUrl: string;
  description: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  timestamp: Date;
  duration: number;
}

export interface YouTubeVideo {
  id: string;
  title: string;
  thumbnailUrl: string;
  description: string;
  views: number;
  likes: number;
  comments: number;
  timestamp: Date;
  duration: number | null; // in seconds
}

// Main creator profile interface
export interface CreatorProfile {
  id: string;
  username: string;
  platform: Platform;
  displayName: string;
  bio?: string;
  profileImageUrl?: string;
  profileImageBase64?: string;
  isVerified: boolean;
  categories: CreatorCategory[];
  location?: string;
  website?: string;
  email?: string;
  lastAnalyzed: Date;
  createdAt: Date;
  
  // Platform-specific metrics
  instagramMetrics?: InstagramMetrics;
  tiktokMetrics?: TikTokMetrics;
  youtubeMetrics?: YouTubeMetrics;
  
  // AI Analysis fields
  aiAnalysis?: Record<string, unknown>; // Will contain the full AI analysis data
  aiSummary?: {
    creator_score: string;
    niche: string;
    brand_potential: string;
    key_strengths: string;
  };
}

// Search and filter types
export interface CreatorFilters {
  platform?: Platform;
  categories?: CreatorCategory[];
  minFollowers?: number;
  maxFollowers?: number;
  minEngagementRate?: number;
  maxEngagementRate?: number;
  isVerified?: boolean;
  location?: string;
}

export interface SearchResult {
  creators: CreatorProfile[];
  totalCount: number;
  hasMore: boolean;
}

// API response types
export interface APIResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
}

// Analysis request types
export interface AnalyzeCreatorRequest {
  username: string;
  platform: Platform;
}

export interface AnalyzeCreatorResponse {
  profile: CreatorProfile;
} 