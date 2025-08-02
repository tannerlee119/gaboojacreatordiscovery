"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreator } from '@/lib/creator-context';
import { formatNumber } from '@/lib/utils';
import { AnalysisModal } from '@/components/ui/analysis-modal';
import { BookmarkCommentModal } from '@/components/ui/bookmark-comment-modal';
import { DiscoveryFilters, DiscoveryFilters as DiscoveryFiltersComponent } from '@/components/ui/discovery-filters';
import { DiscoveryCreatorCard, DiscoveryCreator } from '@/components/ui/discovery-creator-card';
import { addBookmark, removeBookmark, isBookmarked, updateBookmarkComments } from '@/lib/bookmarks';
import { UserBookmarksService } from '@/lib/user-bookmarks';
import { useSupabaseAuth } from '@/lib/supabase-auth-context';
import { Search, Loader2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';

// Storage keys for state persistence
const DISCOVERY_STATE_KEY = 'gabooja-discovery-state';
const RECENT_ANALYSES_COLLAPSED_KEY = 'gabooja-recent-analyses-collapsed';

interface DiscoveryState {
  searchTerm: string;
  filters: DiscoveryFilters;
  currentPage: number;
}

interface AnalysisData {
  profile: {
    username: string;
    platform: 'instagram' | 'tiktok' | 'youtube';
    displayName: string;
    bio?: string;
    profileImageUrl: string;
    isVerified: boolean;
    followerCount: number;
    followingCount: number;
    location?: string;
    website?: string;
    metrics: {
      followerCount?: number;
      followingCount?: number;
      postCount?: number;
      engagementRate?: number;
      likeCount?: number;
      videoCount?: number;
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
    profileImageBase64?: string;
  };
  scrapingDetails: {
    method: string;
    timestamp: string;
  };
}

interface DiscoveryResponse {
  creators: DiscoveryCreator[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  appliedFilters: DiscoveryFilters;
}

export function CreatorDiscovery() {
  const { user, session } = useSupabaseAuth();
  const isAuthenticated = !!session;
  const { analysisHistory } = useCreator();
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedCreatorForComment, setSelectedCreatorForComment] = useState<DiscoveryCreator | null>(null);
  
  // Recent analyses collapsed state
  const [isRecentAnalysesCollapsed, setIsRecentAnalysesCollapsed] = useState(true);
  
  // Discovery state with persistence
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<DiscoveryFilters>({
    platform: 'all',
    category: [],
    minFollowers: 0,
    maxFollowers: 10000000,
    verified: undefined,
    sortBy: 'followers'
  });
  const [discoveryData, setDiscoveryData] = useState<DiscoveryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch discovery data
  const fetchDiscoveryData = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        platform: filters.platform,
        page: page.toString(),
        limit: '12',
        sortBy: filters.sortBy,
        minFollowers: filters.minFollowers.toString(),
        maxFollowers: filters.maxFollowers.toString()
      });

      if (filters.category.length > 0) {
        params.append('category', filters.category.join(','));
      }

      if (filters.verified !== undefined) {
        params.append('verified', filters.verified.toString());
      }

      const response = await fetch(`/api/discover-creators?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch creators');
      }

      const data = await response.json();
      setDiscoveryData(data);
      setCurrentPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch creators');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Load persisted state on mount
  const [isStateLoaded, setIsStateLoaded] = useState(false);
  
  useEffect(() => {
    try {
      // Load discovery state
      const savedState = localStorage.getItem(DISCOVERY_STATE_KEY);
      if (savedState) {
        const state: DiscoveryState = JSON.parse(savedState);

        setSearchTerm(state.searchTerm);
        setFilters(state.filters);
        setCurrentPage(state.currentPage);
      }

      // Load recent analyses collapsed state
      const savedCollapsedState = localStorage.getItem(RECENT_ANALYSES_COLLAPSED_KEY);
      if (savedCollapsedState !== null) {
        setIsRecentAnalysesCollapsed(JSON.parse(savedCollapsedState));
      }

      setIsStateLoaded(true);
    } catch (error) {
      console.error('Error loading discovery state:', error);
      setIsStateLoaded(true);
    }
  }, []);

  // Bookmarks are now loaded from user-specific storage in individual components

  // Load initial data after state is loaded
  useEffect(() => {
    if (isStateLoaded) {
      fetchDiscoveryData(currentPage);
    }
  }, [isStateLoaded, fetchDiscoveryData, currentPage]);

  // Save state whenever it changes (only after state is loaded to avoid overwriting)
  useEffect(() => {
    if (isStateLoaded) {
      try {
        const state: DiscoveryState = {
          searchTerm,
          filters,
          currentPage
        };
        localStorage.setItem(DISCOVERY_STATE_KEY, JSON.stringify(state));
      } catch (error) {
        console.error('Error saving discovery state:', error);
      }
    }
  }, [searchTerm, filters, currentPage, isStateLoaded]);

  // Save collapsed state whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(RECENT_ANALYSES_COLLAPSED_KEY, JSON.stringify(isRecentAnalysesCollapsed));
    } catch (error) {
      console.error('Error saving collapsed state:', error);
    }
  }, [isRecentAnalysesCollapsed]);

  const handleFiltersChange = (newFilters: DiscoveryFilters) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleApplyFilters = () => {
    fetchDiscoveryData(1);
  };

  const handleBookmarkCreator = async (creator: DiscoveryCreator) => {
    if (!user) return;

    const isCurrentlyBookmarked = isAuthenticated ? 
      UserBookmarksService.isUserBookmarked(user.id, creator.username, creator.platform) : 
      isBookmarked(creator.platform, creator.username);
    
    if (isCurrentlyBookmarked) {
      // Remove bookmark
      if (isAuthenticated) {
        UserBookmarksService.removeUserBookmark(user.id, creator.username, creator.platform);
      } else {
        removeBookmark(creator.platform, creator.username);
      }
    } else {
      // Add bookmark
      const bookmarkData = {
        id: Date.now().toString(),
        username: creator.username,
        platform: creator.platform,
        displayName: creator.displayName,
        bio: creator.bio,
        isVerified: creator.isVerified,
        followerCount: creator.followerCount,
        followingCount: creator.followingCount,
        bookmarkedAt: new Date().toISOString(),
      };
      
      if (isAuthenticated) {
        UserBookmarksService.addUserBookmark(user.id, bookmarkData);
      } else {
        addBookmark(bookmarkData);
      }
      
      // Show comment modal after bookmarking
      setSelectedCreatorForComment(creator);
      setShowCommentModal(true);
    }
  };

  const handleSaveComments = async (comments: string) => {
    if (!selectedCreatorForComment || !user) return;
    
    try {
      if (isAuthenticated) {
        UserBookmarksService.updateUserBookmarkComments(
          user.id,
          selectedCreatorForComment.username,
          selectedCreatorForComment.platform,
          comments
        );
      } else {
        updateBookmarkComments(selectedCreatorForComment.platform, selectedCreatorForComment.username, comments);
      }
    } catch (error) {
      console.error('Error saving bookmark comments:', error);
    }
  };

  const handleAnalyzeCreator = async (creator: DiscoveryCreator) => {
    // Trigger analysis - for now, just show a message
    // In the future, this would call the analysis API
    alert(`Analysis for @${creator.username} would be triggered here`);
  };

  const handleViewAnalysis = (analysis: AnalysisData) => {
    setSelectedAnalysis(analysis);
    setIsModalOpen(true);
  };

  const isCreatorBookmarked = (creator: DiscoveryCreator) => {
    if (isAuthenticated && user) {
      return UserBookmarksService.isUserBookmarked(user.id, creator.username, creator.platform);
    } else {
      return isBookmarked(creator.platform, creator.username);
    }
  };

  const filteredCreators = discoveryData?.creators.filter(creator =>
    searchTerm === '' || 
    creator.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    creator.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <Card className="gabooja-card">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search creators by username or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid lg:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1">
          <DiscoveryFiltersComponent
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onApplyFilters={handleApplyFilters}
          />
        </div>

        {/* Discovery Results */}
        <div className="lg:col-span-3">
          <Card className="gabooja-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Discover Creators</span>
                {discoveryData && (
                  <span className="text-sm text-muted-foreground font-normal">
                    {discoveryData.totalCount} creators found
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Find creators across all tiers - from nano influencers to mega creators (focus on mid-tier 10K-100K)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading creators...</span>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center py-12 text-red-500">
                  <AlertCircle className="h-8 w-8 mr-2" />
                  <span>{error}</span>
                </div>
              ) : filteredCreators.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No creators found matching your criteria.</p>
                  <p className="text-sm mt-2">Try adjusting your filters or search term.</p>
                </div>
              ) : (
                <>
                  {/* Creator Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
                    {filteredCreators.map((creator) => (
                      <DiscoveryCreatorCard
                        key={creator.id}
                        creator={creator}
                        isBookmarked={isCreatorBookmarked(creator)}
                        onBookmark={handleBookmarkCreator}
                        onAnalyze={handleAnalyzeCreator}
                      />
                    ))}
                  </div>

                  {/* Pagination */}
                  {discoveryData && discoveryData.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1 || isLoading}
                        onClick={() => fetchDiscoveryData(currentPage - 1)}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {discoveryData.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!discoveryData.hasNextPage || isLoading}
                        onClick={() => fetchDiscoveryData(currentPage + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Analyses Section */}
      {analysisHistory.length > 0 && (
        <Card className="gabooja-card">
          <CardHeader 
            className="cursor-pointer hover:bg-muted/50 transition-colors pb-3"
            onClick={() => setIsRecentAnalysesCollapsed(!isRecentAnalysesCollapsed)}
          >
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                Recent Analyses
                <span className="text-sm font-normal text-muted-foreground">
                  ({analysisHistory.length})
                </span>
              </div>
              {isRecentAnalysesCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </CardTitle>
            <CardDescription>
              Your recently analyzed creators persist across navigation
            </CardDescription>
          </CardHeader>
          
          {!isRecentAnalysesCollapsed && (
            <CardContent>
              <div className="grid gap-4">
                {analysisHistory.slice(0, 5).map((analysis) => (
                  <div key={`${analysis.profile.username}-${analysis.profile.platform}`} 
                       className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-medium">
                          @{analysis.profile.username}
                          {analysis.profile.isVerified && <span className="ml-1 text-primary">✓</span>}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            analysis.profile.platform === 'instagram' 
                              ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
                              : analysis.profile.platform === 'tiktok'
                              ? 'bg-black text-white dark:bg-white dark:text-black'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          }`}>
                            {analysis.profile.platform}
                          </span>
                          • {formatNumber(analysis.profile.followerCount)} followers
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewAnalysis(analysis)}
                    >
                      View Analysis
                    </Button>
                  </div>
                ))}
                {analysisHistory.length > 5 && (
                  <div className="text-center text-sm text-muted-foreground pt-2">
                    Showing 5 of {analysisHistory.length} recent analyses
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Analysis Modal */}
      {selectedAnalysis && (
        <AnalysisModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedAnalysis(null);
          }}
          analysisData={selectedAnalysis}
        />
      )}

      {/* Comment Modal */}
      {selectedCreatorForComment && (
        <BookmarkCommentModal
          isOpen={showCommentModal}
          onClose={() => {
            setShowCommentModal(false);
            setSelectedCreatorForComment(null);
          }}
          onSave={handleSaveComments}
          creatorUsername={selectedCreatorForComment.username}
          platform={selectedCreatorForComment.platform}
          initialComments=""
          isEditing={false}
        />
      )}
    </div>
  );
} 