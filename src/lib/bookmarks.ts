import { Platform } from './types';

export interface BookmarkedCreator {
  id: string;
  username: string;
  platform: Platform;
  displayName: string;
  profileImageUrl?: string;
  isVerified: boolean;
  followerCount: number;
  followingCount: number;
  website?: string;
  bio?: string;
  location?: string;
  bookmarkedAt: string; // ISO timestamp
  comments?: string; // User-added notes/comments
  metrics?: {
    followerCount?: number;
    followingCount?: number;
    postCount?: number;
    likeCount?: number;
    videoCount?: number;
    engagementRate?: number;
    averageViews?: number;
    averageLikes?: number;
  };
  aiAnalysis?: {
    creator_score: string;
    category: string;
    brand_potential: string;
    key_strengths: string;
    engagement_quality: string;
    content_style: string;
    audience_demographics: string;
    collaboration_potential: string;
    overall_assessment: string;
  };
}

const BOOKMARKS_STORAGE_KEY = 'gabooja_bookmarked_creators';

// Get all bookmarked creators from localStorage
export function getBookmarkedCreators(): BookmarkedCreator[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading bookmarks from localStorage:', error);
    return [];
  }
}

// Save bookmarked creators to localStorage
export function saveBookmarkedCreators(bookmarks: BookmarkedCreator[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarks));
  } catch (error) {
    console.error('Error saving bookmarks to localStorage:', error);
  }
}

// Add a creator to bookmarks
export function addBookmark(creator: Omit<BookmarkedCreator, 'id' | 'bookmarkedAt'>): BookmarkedCreator {
  const bookmarks = getBookmarkedCreators();
  
  // Generate unique ID
  const id = `${creator.platform}_${creator.username}_${Date.now()}`;
  
  const newBookmark: BookmarkedCreator = {
    ...creator,
    id,
    bookmarkedAt: new Date().toISOString(),
  };
  
  // Check if already bookmarked (by platform + username)
  const existingIndex = bookmarks.findIndex(
    b => b.platform === creator.platform && b.username === creator.username
  );
  
  if (existingIndex >= 0) {
    // Update existing bookmark with new data
    bookmarks[existingIndex] = newBookmark;
  } else {
    // Add new bookmark
    bookmarks.unshift(newBookmark); // Add to beginning for newest first
  }
  
  saveBookmarkedCreators(bookmarks);
  return newBookmark;
}

// Remove a creator from bookmarks
export function removeBookmark(platform: Platform, username: string): void {
  const bookmarks = getBookmarkedCreators();
  const filtered = bookmarks.filter(
    b => !(b.platform === platform && b.username === username)
  );
  saveBookmarkedCreators(filtered);
}

// Check if a creator is bookmarked
export function isBookmarked(platform: Platform, username: string): boolean {
  const bookmarks = getBookmarkedCreators();
  return bookmarks.some(b => b.platform === platform && b.username === username);
}

// Get bookmark by platform and username
export function getBookmark(platform: Platform, username: string): BookmarkedCreator | null {
  const bookmarks = getBookmarkedCreators();
  return bookmarks.find(b => b.platform === platform && b.username === username) || null;
}

// Update bookmark comments
export function updateBookmarkComments(platform: Platform, username: string, comments: string): boolean {
  const bookmarks = getBookmarkedCreators();
  const bookmarkIndex = bookmarks.findIndex(
    b => b.platform === platform && b.username === username
  );
  
  if (bookmarkIndex >= 0) {
    bookmarks[bookmarkIndex] = {
      ...bookmarks[bookmarkIndex],
      comments
    };
    saveBookmarkedCreators(bookmarks);
    return true;
  }
  
  return false;
}

// Clear all bookmarks
export function clearAllBookmarks(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(BOOKMARKS_STORAGE_KEY);
} 