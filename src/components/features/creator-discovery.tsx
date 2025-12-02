"use client";

import React, { useState, useEffect, useCallback, useMemo, useDeferredValue, useRef, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCreator } from '@/lib/creator-context';
import { formatNumber } from '@/lib/utils';
import { AnalysisModal } from '@/components/ui/analysis-modal';
import { BookmarkCommentModal } from '@/components/ui/bookmark-comment-modal';
import { DiscoveryFilters, DiscoveryFilters as DiscoveryFiltersComponent } from '@/components/ui/discovery-filters';
import { DiscoveryCreatorCard, DiscoveryCreator } from '@/components/ui/discovery-creator-card';
import { PaginationComponent } from '@/components/ui/pagination-component';
import { GrowthChartModal } from '@/components/features/growth-chart-modal';
import { addBookmark, removeBookmark, isBookmarked, updateBookmarkComments } from '@/lib/bookmarks';
import { UserBookmarksService } from '@/lib/user-bookmarks';
import { useSupabaseAuth } from '@/lib/supabase-auth-context';
import { Search, Loader2, AlertCircle, ChevronDown, ChevronRight, X } from 'lucide-react';

// Storage keys for state persistence
const DISCOVERY_STATE_KEY = 'gabooja-discovery-state-v3'; // Incremented to clear old invalid data and fix TikTok display
const RECENT_ANALYSES_COLLAPSED_KEY = 'gabooja-recent-analyses-collapsed';

interface DiscoveryState {
  searchTerm: string;
  filters: DiscoveryFilters;
  currentPage: number;
}

interface AnalysisData {
  profile: {
    username: string;
    platform: 'instagram' | 'tiktok';
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
  growthData?: {
    previousFollowerCount: number;
    growthPercentage: number;
  };
  lastAnalyzed?: string;
  cached?: boolean;
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
  const resultsSectionRef = useRef<HTMLDivElement | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedCreatorForComment, setSelectedCreatorForComment] = useState<DiscoveryCreator | null>(null);
  const [showGrowthChart, setShowGrowthChart] = useState(false);
  const [selectedCreatorForGrowth, setSelectedCreatorForGrowth] = useState<DiscoveryCreator | null>(null);
  
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
    sortBy: 'followers-desc'
  });
  const [discoveryData, setDiscoveryData] = useState<DiscoveryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [bookmarkUpdate, setBookmarkUpdate] = useState(0); // Force re-renders when bookmarks change
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [isPending, startTransition] = useTransition();
  const isBusy = isLoading || isPending;
  const skeletonPlaceholders = useMemo(() => Array.from({ length: 6 }), []);

  const getActiveFilterCount = useCallback((filterSet: DiscoveryFilters) => {
    let count = 0;
    if (filterSet.platform !== 'all') count++;
    if (filterSet.category.length > 0) count++;
    if (filterSet.minFollowers > 0 || filterSet.maxFollowers < 10000000) count++;
    if (filterSet.verified !== undefined) count++;
    if (filterSet.sortBy !== 'followers-desc') count++;
    return count;
  }, []);

  const activeFilterCount = useMemo(
    () => getActiveFilterCount(filters),
    [filters, getActiveFilterCount]
  );

  const renderSkeletonGrid = useCallback(() => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
      {skeletonPlaceholders.map((_, index) => (
        <div
          key={`discovery-skeleton-${index}`}
          className="rounded-2xl border border-border/40 bg-muted/30 p-4 animate-pulse space-y-4"
        >
          <div className="h-4 w-1/3 bg-muted-foreground/20 rounded" />
          <div className="h-3 w-1/2 bg-muted-foreground/15 rounded" />
          <div className="h-20 w-full bg-muted-foreground/10 rounded" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-8 bg-muted-foreground/10 rounded" />
            <div className="h-8 bg-muted-foreground/10 rounded" />
          </div>
        </div>
      ))}
    </div>
  ), [skeletonPlaceholders]);


  // Fetch discovery data with specific filters  
  const fetchDiscoveryDataWithFilters = useCallback(async (filtersToUse: DiscoveryFilters, page = 1) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        platform: filtersToUse.platform,
        page: page.toString(),
        limit: '12',
        sortBy: filtersToUse.sortBy,
        minFollowers: filtersToUse.minFollowers.toString(),
        maxFollowers: filtersToUse.maxFollowers.toString()
      });

      if (filtersToUse.category.length > 0) {
        params.append('category', filtersToUse.category.join(','));
      }

      if (filtersToUse.verified !== undefined) {
        params.append('verified', filtersToUse.verified.toString());
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
  }, []);

  // Fetch discovery data using current filters (for backwards compatibility)
  const fetchDiscoveryData = useCallback(async (page = 1) => {
    await fetchDiscoveryDataWithFilters(filters, page);
  }, [filters, fetchDiscoveryDataWithFilters]);

  // Load persisted state on mount
  const [isStateLoaded, setIsStateLoaded] = useState(false);
  const hasBootstrapped = useRef(false);
  
  useEffect(() => {
    try {
      // Clean up old localStorage keys to fix TikTok display issue
      localStorage.removeItem('gabooja-discovery-state');
      localStorage.removeItem('gabooja-discovery-state-v2');
      
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

  useEffect(() => {
    if (!isStateLoaded || hasBootstrapped.current || discoveryData || isLoading) {
      return;
    }

    hasBootstrapped.current = true;
    fetchDiscoveryDataWithFilters(filters, currentPage);
  }, [isStateLoaded, discoveryData, isLoading, filters, currentPage, fetchDiscoveryDataWithFilters]);

  const handleFiltersChange = (newFilters: DiscoveryFilters) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleApplyFilters = (filtersToApply?: DiscoveryFilters) => {
    // If specific filters are provided, use those; otherwise use current filters
    const activeFilters = filtersToApply || filters;
    startTransition(() => {
      fetchDiscoveryDataWithFilters(activeFilters, 1);
    });
  };

  const handleBookmarkCreator = async (creator: DiscoveryCreator) => {
    if (!user) return;

    const isCurrentlyBookmarked = isAuthenticated ? 
      await UserBookmarksService.isUserBookmarked(user.id, creator.username, creator.platform) : 
      isBookmarked(creator.platform, creator.username);
    
    if (isCurrentlyBookmarked) {
      // Remove bookmark
      if (isAuthenticated) {
        await UserBookmarksService.removeUserBookmark(user.id, creator.username, creator.platform);
      } else {
        removeBookmark(creator.platform, creator.username);
      }
      
      // Force re-render to update bookmark state in UI
      setBookmarkUpdate(prev => prev + 1);
    } else {
      // Add bookmark with complete AI analysis data
      const bookmarkData = {
        id: Date.now().toString(),
        username: creator.username,
        platform: creator.platform,
        displayName: creator.displayName,
        bio: creator.overallAssessment || creator.displayName,
        profileImageUrl: creator.profileImageUrl,
        isVerified: creator.isVerified,
        followerCount: creator.followerCount,
        followingCount: creator.followingCount,
        location: creator.location,
        website: creator.website,
        bookmarkedAt: new Date().toISOString(),
        // Include full AI analysis data from discovery
        aiAnalysis: {
          creator_score: creator.aiScore || '0',
          category: creator.category || 'other',
          brand_potential: creator.brandPotential || '',
          key_strengths: creator.keyStrengths || '',
          engagement_quality: creator.engagementQuality || '',
          content_style: creator.contentStyle || '',
          audience_demographics: creator.audienceDemographics || '',
          collaboration_potential: creator.collaborationPotential || '',
          overall_assessment: creator.overallAssessment || '',
        },
        // Include metrics data
        metrics: {
          followerCount: creator.followerCount,
          followingCount: creator.followingCount,
          engagementRate: creator.engagementRate,
        }
      };
      
      if (isAuthenticated) {
        await UserBookmarksService.addUserBookmark(user.id, bookmarkData);
      } else {
        addBookmark(bookmarkData);
      }
      
      // Show comment modal after bookmarking
      setSelectedCreatorForComment(creator);
      setShowCommentModal(true);
    }
    
    // Force re-render to update bookmark state in UI
    setBookmarkUpdate(prev => prev + 1);
  };

  const handleSaveComments = async (comments: string) => {
    if (!selectedCreatorForComment || !user) return;
    
    try {
      if (isAuthenticated) {
        await UserBookmarksService.updateUserBookmarkComments(
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

  const handlePageChange = (page: number) => {
    const target = resultsSectionRef.current;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    startTransition(() => {
      fetchDiscoveryData(page);
    });
  };

  const handleRefreshFromModal = async (username: string, platform: string) => {
    // Redirect to analyze page with refresh parameters
    const searchParams = new URLSearchParams({
      username: username,
      platform: platform,
      refresh: 'true'
    });
    
    // Close the modal first
    setIsModalOpen(false);
    setSelectedAnalysis(null);
    
    // Navigate to analyze page with parameters
    window.location.href = `/analyze?${searchParams.toString()}`;
  };


  const handleViewAnalysis = (analysis: AnalysisData) => {
    setSelectedAnalysis(analysis);
    setIsModalOpen(true);
  };

  const handleGrowthChart = (creator: DiscoveryCreator) => {
    setSelectedCreatorForGrowth(creator);
    setShowGrowthChart(true);
  };

  const handleViewCreatorAnalysis = (creator: DiscoveryCreator) => {
    // Convert DiscoveryCreator to AnalysisData format
    const analysisData: AnalysisData = {
      profile: {
        username: creator.username,
        platform: creator.platform as 'instagram' | 'tiktok',
        displayName: creator.displayName,
        bio: creator.bio || creator.overallAssessment,
        profileImageUrl: creator.profileImageUrl || '',
        isVerified: creator.isVerified,
        followerCount: creator.followerCount,
        followingCount: creator.followingCount,
        location: creator.location,
        website: creator.website,
        metrics: {
          followerCount: creator.followerCount,
          followingCount: creator.followingCount,
          engagementRate: creator.engagementRate,
        },
        aiAnalysis: {
          creator_score: creator.aiScore || '0',
          category: creator.category || 'other',
          brand_potential: creator.brandPotential || '',
          key_strengths: creator.keyStrengths || '',
          engagement_quality: creator.engagementQuality || '',
          content_style: creator.contentStyle || '',
          audience_demographics: creator.audienceDemographics || '',
          collaboration_potential: creator.collaborationPotential || '',
          overall_assessment: creator.overallAssessment || '',
        },
      },
      scrapingDetails: {
        method: 'From Discovery',
        timestamp: creator.lastAnalysisDate || new Date().toISOString(),
      },
      // Pass through growth data if available
      growthData: creator.growthData,
      lastAnalyzed: creator.lastAnalysisDate,
      cached: true, // Data from discovery is considered cached
    };
    
    setSelectedAnalysis(analysisData);
    setIsModalOpen(true);
  };

  const [bookmarkStatuses, setBookmarkStatuses] = useState<Record<string, boolean>>({});

  const filteredCreators = useMemo(() => {
    if (!discoveryData) {
      return [];
    }

    const loweredSearch = deferredSearchTerm.trim().toLowerCase();

    if (!loweredSearch) {
      return discoveryData.creators;
    }

    return discoveryData.creators.filter((creator) => {
      const usernameMatch = creator.username.toLowerCase().includes(loweredSearch);
      const displayNameMatch = creator.displayName?.toLowerCase().includes(loweredSearch);
      return usernameMatch || displayNameMatch;
    });
  }, [deferredSearchTerm, discoveryData]);
  const visibleCreatorCount = filteredCreators.length;

  const isCreatorBookmarked = (creator: DiscoveryCreator) => {
    // bookmarkUpdate is used in dependency arrays to trigger re-renders
    const key = `${creator.username}_${creator.platform}`;
    return bookmarkStatuses[key] || false;
  };

  // Load bookmark statuses when creators change
  const updateBookmarkStatuses = useCallback(async () => {
    if (!filteredCreators.length) return;

    const statusEntries = await Promise.all(
      filteredCreators.map(async (creator) => {
        const key = `${creator.username}_${creator.platform}`;

        if (isAuthenticated && user) {
          const isSaved = await UserBookmarksService.isUserBookmarked(
            user.id,
            creator.username,
            creator.platform
          );
          return [key, isSaved] as const;
        }

        return [key, isBookmarked(creator.platform, creator.username)] as const;
      })
    );

    setBookmarkStatuses(Object.fromEntries(statusEntries));
  }, [filteredCreators, isAuthenticated, user]);

  // Update bookmark statuses when creators or bookmark state changes
  useEffect(() => {
    updateBookmarkStatuses();
  }, [updateBookmarkStatuses, bookmarkUpdate]);

  const shouldShowInitialLoader = isBusy && !discoveryData;
  const shouldShowSkeletonGrid = isBusy && !!discoveryData;
  const showEmptyState = !shouldShowSkeletonGrid && discoveryData && filteredCreators.length === 0;

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
              className="pl-10 pr-10"
            />
            {searchTerm && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3 justify-between rounded-2xl border border-border/60 bg-card/60 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Active filters</span>
          <Badge variant="secondary" className="px-2 py-0.5 text-xs font-semibold">
            {activeFilterCount}
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          Showing{' '}
          <span className="font-semibold text-foreground">{visibleCreatorCount}</span>
          {typeof discoveryData?.totalCount === 'number' && (
            <>
              <span className="mx-1 text-muted-foreground">/</span>
              <span className="font-semibold text-foreground">{discoveryData.totalCount}</span>
            </>
          )}{' '}
          creators
        </div>
        <div className="flex items-center gap-2">
          {isBusy ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Refreshing
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleApplyFilters(filters)}
              className="text-xs cursor-pointer hover:bg-primary/10 hover:text-foreground hover:border-primary/30"
            >
              Sync results
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Sidebar - Full width on mobile, sidebar on desktop */}
        <div className="lg:col-span-1 order-first lg:sticky lg:top-28 h-fit">
          <DiscoveryFiltersComponent
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onApplyFilters={handleApplyFilters}
            isLoading={isLoading}
          />
        </div>

        {/* Discovery Results */}
        <div
          className="lg:col-span-3 order-last"
          data-results-section
          ref={resultsSectionRef}
        >
          <Card className="gabooja-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Discover Creators</span>
                <div className="flex items-center gap-2">
                  {isBusy && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {!isBusy && discoveryData && discoveryData.totalCount !== undefined && (
                    <span className="text-sm text-muted-foreground font-normal">
                      {discoveryData.totalCount} creators found
                    </span>
                  )}
                </div>
              </CardTitle>
              <CardDescription>
                Find creators across all tiers - from nano influencers to mega creators (focus on mid-tier 10K-100K)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {shouldShowInitialLoader ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading creators...</span>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center py-12 text-red-500">
                  <AlertCircle className="h-8 w-8 mr-2" />
                  <span>{error}</span>
                </div>
              ) : !discoveryData ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Initializing...</span>
                </div>
              ) : showEmptyState ? (
                <div className="text-center py-12 text-muted-foreground">
                  {searchTerm ? (
                    <>
                      <p>No creators found matching &quot;{searchTerm}&quot; on this page.</p>
                      <p className="text-sm mt-2">Try searching on other pages or adjusting your search term.</p>
                    </>
                  ) : (
                    <>
                      <p>No creators found matching your criteria.</p>
                      <p className="text-sm mt-2">Try adjusting your filters.</p>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {/* Top Pagination - Always show when there are multiple pages */}
                  {discoveryData && discoveryData.totalPages > 1 && (
                    <div className="mb-6">
                      <PaginationComponent 
                        currentPage={currentPage}
                        totalPages={discoveryData.totalPages}
                        onPageChange={handlePageChange}
                        isLoading={isLoading}
                      />
                    </div>
                  )}
                  
                  {/* Creator Grid */}
                  {shouldShowSkeletonGrid ? (
                    renderSkeletonGrid()
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
                      {filteredCreators.map((creator) => (
                        <DiscoveryCreatorCard
                          key={creator.id}
                          creator={creator}
                          isBookmarked={isCreatorBookmarked(creator)}
                          onBookmark={handleBookmarkCreator}
                          onViewAnalysis={handleViewCreatorAnalysis}
                          onGrowthChart={handleGrowthChart}
                        />
                      ))}
                    </div>
                  )}

                  {/* Bottom Pagination - Always show when there are multiple pages */}
                  {discoveryData && discoveryData.totalPages > 1 && (
                    <div className="mt-6">
                      <PaginationComponent 
                        currentPage={currentPage}
                        totalPages={discoveryData.totalPages}
                        onPageChange={handlePageChange}
                        isLoading={isLoading}
                      />
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
                              ? 'bg-[#ff5c8f] text-white'
                              : analysis.profile.platform === 'tiktok'
                              ? 'bg-secondary text-foreground'
                              : 'bg-muted text-muted-foreground'
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
                      className="text-xs hover:bg-primary/10 hover:text-foreground hover:border-primary/30 transition-all duration-200"
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
          onRefresh={handleRefreshFromModal}
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

      {/* Growth Chart Modal */}
      {selectedCreatorForGrowth && (
        <GrowthChartModal
          creator={{
            username: selectedCreatorForGrowth.username,
            platform: selectedCreatorForGrowth.platform,
            displayName: selectedCreatorForGrowth.displayName
          }}
          isOpen={showGrowthChart}
          onClose={() => {
            setShowGrowthChart(false);
            setSelectedCreatorForGrowth(null);
          }}
        />
      )}
    </div>
  );
} 