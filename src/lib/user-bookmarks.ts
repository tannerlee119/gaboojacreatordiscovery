import { BookmarkedCreator } from './bookmarks';
import { DatabaseBookmarkService } from './database/bookmark-service';

// Define a simplified analysis result type to avoid circular imports
interface AnalysisResult {
  profile: {
    username: string;
    platform: string;
    displayName: string;
    bio?: string;
    profileImageUrl: string;
    isVerified: boolean;
    followerCount: number;
    followingCount: number;
    location?: string;
    website?: string;
    metrics: Record<string, unknown>;
    aiAnalysis?: Record<string, unknown>;
  };
  scrapingDetails: {
    method: string;
    timestamp: string;
  };
}

// User settings interface
export interface UserSettings {
  theme?: 'light' | 'dark' | 'system';
  autoSave?: boolean;
  showBookmarks?: boolean;
  showRecentSearches?: boolean;
  [key: string]: unknown; // Allow additional settings
}

export interface UserDataExport {
  bookmarks: UserBookmark[];
  recentSearches: RecentSearch[];
  settings: UserSettings;
  exportedAt: string;
}

export interface UserBookmark extends BookmarkedCreator {
  userId: string;
  bookmarkedAt: string;
}

export interface RecentSearch {
  id: string;
  userId: string;
  username: string;
  platform: 'instagram' | 'tiktok';
  searchedAt: string;
  analysisData?: AnalysisResult; // Store analysis results
}

export class UserBookmarksService {
  private static getStorageKey(userId: string, type: 'bookmarks' | 'recent-searches') {
    return `user_${userId}_${type}`;
  }

  /**
   * Check if we should use database (for authenticated users) or localStorage (fallback)
   */
  private static shouldUseDatabase(): boolean {
    // For now, always try to use database for authenticated users
    // You could add additional checks here (e.g., feature flags, user preferences)
    return typeof window !== 'undefined';
  }

  // Bookmarks
  static async getUserBookmarks(userId: string): Promise<UserBookmark[]> {
    if (typeof window === 'undefined') return [];
    
    if (this.shouldUseDatabase()) {
      try {
        const dbBookmarks = await DatabaseBookmarkService.getUserBookmarks(userId);
        return dbBookmarks.map(dbBookmark => ({
          ...DatabaseBookmarkService.convertToBookmarkedCreator(dbBookmark),
          userId: dbBookmark.user_id,
          bookmarkedAt: dbBookmark.bookmarked_at
        }));
      } catch (error) {
        console.error('Error loading user bookmarks from database, falling back to localStorage:', error);
        // Fall back to localStorage
      }
    }
    
    // localStorage fallback
    try {
      const key = this.getStorageKey(userId, 'bookmarks');
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading user bookmarks:', error);
      return [];
    }
  }

  static async addUserBookmark(userId: string, creator: BookmarkedCreator): Promise<void> {
    if (typeof window === 'undefined') return;
    
    if (this.shouldUseDatabase()) {
      try {
        const success = await DatabaseBookmarkService.addUserBookmark(
          userId, 
          creator.username, 
          creator.platform as 'instagram' | 'tiktok',
          creator.comments
        );
        if (success) return;
        console.error('Failed to add bookmark to database, falling back to localStorage');
      } catch (error) {
        console.error('Error adding user bookmark to database, falling back to localStorage:', error);
      }
    }
    
    // localStorage fallback
    try {
      const bookmarks = await this.getUserBookmarks(userId);
      const existingIndex = bookmarks.findIndex(
        bookmark => bookmark.username === creator.username && bookmark.platform === creator.platform
      );

      const userBookmark: UserBookmark = {
        ...creator,
        userId,
        bookmarkedAt: new Date().toISOString()
      };

      if (existingIndex >= 0) {
        // Update existing bookmark
        bookmarks[existingIndex] = userBookmark;
      } else {
        // Add new bookmark
        bookmarks.push(userBookmark);
      }

      const key = this.getStorageKey(userId, 'bookmarks');
      localStorage.setItem(key, JSON.stringify(bookmarks));
    } catch (error) {
      console.error('Error adding user bookmark:', error);
    }
  }

  static async removeUserBookmark(userId: string, username: string, platform: 'instagram' | 'tiktok'): Promise<void> {
    if (typeof window === 'undefined') return;
    
    if (this.shouldUseDatabase()) {
      try {
        const success = await DatabaseBookmarkService.removeUserBookmark(userId, username, platform as 'instagram' | 'tiktok');
        if (success) return;
        console.error('Failed to remove bookmark from database, falling back to localStorage');
      } catch (error) {
        console.error('Error removing user bookmark from database, falling back to localStorage:', error);
      }
    }
    
    // localStorage fallback
    try {
      const bookmarks = await this.getUserBookmarks(userId);
      const filteredBookmarks = bookmarks.filter(
        bookmark => !(bookmark.username === username && bookmark.platform === platform)
      );

      const key = this.getStorageKey(userId, 'bookmarks');
      localStorage.setItem(key, JSON.stringify(filteredBookmarks));
    } catch (error) {
      console.error('Error removing user bookmark:', error);
    }
  }

  static async isUserBookmarked(userId: string, username: string, platform: 'instagram' | 'tiktok'): Promise<boolean> {
    if (this.shouldUseDatabase()) {
      try {
        return await DatabaseBookmarkService.isUserBookmarked(userId, username, platform as 'instagram' | 'tiktok');
      } catch (error) {
        console.error('Error checking bookmark status from database, falling back to localStorage:', error);
      }
    }
    
    // localStorage fallback
    const bookmarks = await this.getUserBookmarks(userId);
    return bookmarks.some(
      bookmark => bookmark.username === username && bookmark.platform === platform
    );
  }

  static async updateUserBookmarkComments(userId: string, username: string, platform: 'instagram' | 'tiktok', comments: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    
    if (this.shouldUseDatabase()) {
      try {
        return await DatabaseBookmarkService.updateUserBookmarkComments(userId, username, platform as 'instagram' | 'tiktok', comments);
      } catch (error) {
        console.error('Error updating bookmark comments in database, falling back to localStorage:', error);
      }
    }
    
    // localStorage fallback
    try {
      const bookmarks = await this.getUserBookmarks(userId);
      const bookmarkIndex = bookmarks.findIndex(
        bookmark => bookmark.username === username && bookmark.platform === platform
      );
      
      if (bookmarkIndex >= 0) {
        bookmarks[bookmarkIndex] = {
          ...bookmarks[bookmarkIndex],
          comments
        };
        
        const key = this.getStorageKey(userId, 'bookmarks');
        localStorage.setItem(key, JSON.stringify(bookmarks));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error updating bookmark comments:', error);
      return false;
    }
  }

  static async updateUserBookmark(userId: string, updatedBookmark: UserBookmark): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    
    if (this.shouldUseDatabase()) {
      try {
        // TODO: Add database method for updating full bookmark data
        // For now, fallback to localStorage
      } catch (error) {
        console.error('Error updating bookmark in database, falling back to localStorage:', error);
      }
    }
    
    // localStorage implementation
    try {
      const bookmarks = await this.getUserBookmarks(userId);
      const bookmarkIndex = bookmarks.findIndex(
        bookmark => bookmark.username === updatedBookmark.username && bookmark.platform === updatedBookmark.platform
      );
      
      if (bookmarkIndex >= 0) {
        bookmarks[bookmarkIndex] = updatedBookmark;
        
        const key = this.getStorageKey(userId, 'bookmarks');
        localStorage.setItem(key, JSON.stringify(bookmarks));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error updating bookmark:', error);
      return false;
    }
  }

  static async clearUserBookmarks(userId: string): Promise<void> {
    if (typeof window === 'undefined') return;
    
    if (this.shouldUseDatabase()) {
      try {
        const success = await DatabaseBookmarkService.clearUserBookmarks(userId);
        if (success) {
          // Also clear localStorage
          const key = this.getStorageKey(userId, 'bookmarks');
          localStorage.removeItem(key);
          return;
        }
        console.error('Failed to clear bookmarks from database');
      } catch (error) {
        console.error('Error clearing user bookmarks from database:', error);
      }
    }
    
    // localStorage fallback
    try {
      const key = this.getStorageKey(userId, 'bookmarks');
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error clearing user bookmarks:', error);
    }
  }

  // Recent Searches
  static getUserRecentSearches(userId: string, limit: number = 10): RecentSearch[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const key = this.getStorageKey(userId, 'recent-searches');
      const data = localStorage.getItem(key);
      const searches = data ? JSON.parse(data) : [];
      
      // Sort by most recent and limit results
      return searches
        .sort((a: RecentSearch, b: RecentSearch) => 
          new Date(b.searchedAt).getTime() - new Date(a.searchedAt).getTime()
        )
        .slice(0, limit);
    } catch (error) {
      console.error('Error loading user recent searches:', error);
      return [];
    }
  }

  static addUserRecentSearch(
    userId: string, 
    username: string, 
    platform: 'instagram' | 'tiktok',
    analysisData?: AnalysisResult
  ): void {
    if (typeof window === 'undefined') return;
    
    try {
      const key = this.getStorageKey(userId, 'recent-searches');
      const searches = this.getUserRecentSearches(userId, 50); // Get more to avoid duplicates
      
      // Remove existing entry for this username/platform
      const filteredSearches = searches.filter(
        search => !(search.username === username && search.platform === platform)
      );

      // Add new search at the beginning (exclude large screenshot data)
      const lightAnalysisData = analysisData ? {
        ...analysisData,
        profile: {
          ...analysisData.profile,
          profileImageBase64: undefined // Exclude large screenshot data
        }
      } : undefined;

      const newSearch: RecentSearch = {
        id: Date.now().toString(),
        userId,
        username,
        platform,
        searchedAt: new Date().toISOString(),
        analysisData: lightAnalysisData
      };

      filteredSearches.unshift(newSearch);

      // Keep only the most recent 20 searches
      const limitedSearches = filteredSearches.slice(0, 20);
      
      localStorage.setItem(key, JSON.stringify(limitedSearches));
    } catch (error) {
      console.error('Error adding user recent search:', error);
    }
  }

  static clearUserRecentSearches(userId: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      const key = this.getStorageKey(userId, 'recent-searches');
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error clearing user recent searches:', error);
    }
  }

  static removeUserRecentSearch(userId: string, searchId: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      const searches = this.getUserRecentSearches(userId, 50);
      const filteredSearches = searches.filter(search => search.id !== searchId);
      
      const key = this.getStorageKey(userId, 'recent-searches');
      localStorage.setItem(key, JSON.stringify(filteredSearches));
    } catch (error) {
      console.error('Error removing user recent search:', error);
    }
  }

  // User Settings
  static getUserSettings(userId: string): UserSettings {
    if (typeof window === 'undefined') return {};
    
    try {
      const key = `user_${userId}_settings`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error loading user settings:', error);
      return {};
    }
  }

  static saveUserSettings(userId: string, settings: UserSettings): void {
    if (typeof window === 'undefined') return;
    
    try {
      const key = `user_${userId}_settings`;
      localStorage.setItem(key, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving user settings:', error);
    }
  }

  // User Data Export
  static async exportUserData(userId: string): Promise<UserDataExport> {
    return {
      bookmarks: await this.getUserBookmarks(userId),
      recentSearches: this.getUserRecentSearches(userId, 50),
      settings: this.getUserSettings(userId),
      exportedAt: new Date().toISOString()
    };
  }

  // User Data Import
  static importUserData(userId: string, data: UserDataExport): void {
    if (typeof window === 'undefined') return;
    
    try {
      if (data.bookmarks) {
        const bookmarksKey = this.getStorageKey(userId, 'bookmarks');
        localStorage.setItem(bookmarksKey, JSON.stringify(data.bookmarks));
      }

      if (data.recentSearches) {
        const searchesKey = this.getStorageKey(userId, 'recent-searches');
        localStorage.setItem(searchesKey, JSON.stringify(data.recentSearches));
      }

      if (data.settings) {
        const settingsKey = `user_${userId}_settings`;
        localStorage.setItem(settingsKey, JSON.stringify(data.settings));
      }
    } catch (error) {
      console.error('Error importing user data:', error);
    }
  }
} 