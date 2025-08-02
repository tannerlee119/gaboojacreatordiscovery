import { BookmarkedCreator } from './bookmarks';

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

  // Bookmarks
  static getUserBookmarks(userId: string): UserBookmark[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const key = this.getStorageKey(userId, 'bookmarks');
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading user bookmarks:', error);
      return [];
    }
  }

  static addUserBookmark(userId: string, creator: BookmarkedCreator): void {
    if (typeof window === 'undefined') return;
    
    try {
      const bookmarks = this.getUserBookmarks(userId);
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

  static removeUserBookmark(userId: string, username: string, platform: 'instagram' | 'tiktok'): void {
    if (typeof window === 'undefined') return;
    
    try {
      const bookmarks = this.getUserBookmarks(userId);
      const filteredBookmarks = bookmarks.filter(
        bookmark => !(bookmark.username === username && bookmark.platform === platform)
      );

      const key = this.getStorageKey(userId, 'bookmarks');
      localStorage.setItem(key, JSON.stringify(filteredBookmarks));
    } catch (error) {
      console.error('Error removing user bookmark:', error);
    }
  }

  static isUserBookmarked(userId: string, username: string, platform: 'instagram' | 'tiktok'): boolean {
    const bookmarks = this.getUserBookmarks(userId);
    return bookmarks.some(
      bookmark => bookmark.username === username && bookmark.platform === platform
    );
  }

  static updateUserBookmarkComments(userId: string, username: string, platform: 'instagram' | 'tiktok', comments: string): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      const bookmarks = this.getUserBookmarks(userId);
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

  static clearUserBookmarks(userId: string): void {
    if (typeof window === 'undefined') return;
    
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

      // Add new search at the beginning
      const newSearch: RecentSearch = {
        id: Date.now().toString(),
        userId,
        username,
        platform,
        searchedAt: new Date().toISOString(),
        analysisData
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
  static exportUserData(userId: string): UserDataExport {
    return {
      bookmarks: this.getUserBookmarks(userId),
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