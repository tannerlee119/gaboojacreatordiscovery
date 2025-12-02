"use client";

import { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getBookmarkedCreators, removeBookmark, updateBookmarkComments } from '@/lib/bookmarks';
import { formatNumber } from '@/lib/utils';
import { Trash2, ExternalLink, Link, Eye, MessageSquare, Edit3, X } from 'lucide-react';
import { AnalysisModal } from '@/components/ui/analysis-modal';
import { BookmarkCommentModal } from '@/components/ui/bookmark-comment-modal';
import { DeleteConfirmationModal } from '@/components/ui/delete-confirmation-modal';
import { GrowthChartModal } from '@/components/features/growth-chart-modal';
import { useSupabaseAuth } from '@/lib/supabase-auth-context';
import { UserBookmarksService, UserBookmark } from '@/lib/user-bookmarks';
import { supabase } from '@/lib/supabase';

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

export default function BookmarksPage() {
  const { user, session } = useSupabaseAuth();
  const isAuthenticated = !!session;
  const [bookmarks, setBookmarks] = useState<UserBookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedBookmark, setSelectedBookmark] = useState<UserBookmark | null>(null);
  const [showGrowthChart, setShowGrowthChart] = useState(false);
  const [selectedBookmarkForGrowth, setSelectedBookmarkForGrowth] = useState<UserBookmark | null>(null);
  const [bookmarkGrowthData, setBookmarkGrowthData] = useState<Record<string, { previousFollowerCount: number; growthPercentage: number; lastAnalyzed: string }>>({});
  const [isLoadingGrowthData, setIsLoadingGrowthData] = useState(false);
  const [categoryUpdateTimestamp, setCategoryUpdateTimestamp] = useState<number>(0);
  const [platformFilter, setPlatformFilter] = useState<'all' | 'instagram' | 'tiktok'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'followers' | 'growth'>('recent');
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm.trim().toLowerCase());
  const filteredBookmarks = useMemo(() => {
    let list = [...bookmarks];

    if (platformFilter !== 'all') {
      list = list.filter((bookmark) => bookmark.platform === platformFilter);
    }

    if (deferredSearchTerm) {
      list = list.filter(
        (bookmark) =>
          bookmark.username.toLowerCase().includes(deferredSearchTerm) ||
          bookmark.displayName?.toLowerCase().includes(deferredSearchTerm)
      );
    }

    const getGrowthValue = (bookmark: UserBookmark) =>
      bookmarkGrowthData[`${bookmark.username}_${bookmark.platform}`]?.growthPercentage ?? Number.NEGATIVE_INFINITY;

    switch (sortBy) {
      case 'followers':
        list.sort((a, b) => b.followerCount - a.followerCount);
        break;
      case 'growth':
        list.sort((a, b) => getGrowthValue(b) - getGrowthValue(a));
        break;
      default:
        list.sort(
          (a, b) =>
            new Date(b.bookmarkedAt).getTime() - new Date(a.bookmarkedAt).getTime()
        );
    }

    return list;
  }, [bookmarks, platformFilter, deferredSearchTerm, sortBy, bookmarkGrowthData]);
  const filteredCount = filteredBookmarks.length;
  const totalFollowers = useMemo(
    () => bookmarks.reduce((sum, bookmark) => sum + (bookmark.followerCount || 0), 0),
    [bookmarks]
  );
  const averageFollowers = bookmarks.length ? totalFollowers / bookmarks.length : 0;
  const verifiedCount = useMemo(
    () => bookmarks.filter((bookmark) => bookmark.isVerified).length,
    [bookmarks]
  );
  const averageGrowth = useMemo(() => {
    const values = filteredBookmarks
      .map((bookmark) => bookmarkGrowthData[`${bookmark.username}_${bookmark.platform}`]?.growthPercentage)
      .filter((value): value is number => typeof value === 'number');
    if (!values.length) {
      return 0;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [filteredBookmarks, bookmarkGrowthData]);
  const formatGrowthValue = (value: number) =>
    `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      fitness: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      sports: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      food: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      tech: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
      beauty: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
      travel: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      comedy: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      fashion: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
      gaming: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      music: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
      education: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      business: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300',
      art: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
      pets: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      family: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
      lifestyle: 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300',
    };
    return colors[category] || 'bg-muted text-muted-foreground';
  };

  // Load bookmarks - using useEffect with proper dependency management
  useEffect(() => {
    const loadBookmarks = async () => {
      // Only run client-side and after auth state is determined
      if (typeof window === 'undefined') {
        return;
      }
      
      setLoading(true);
      
      try {
        if (isAuthenticated && user) {
          const userBookmarks = await UserBookmarksService.getUserBookmarks(user.id);
          setBookmarks(userBookmarks);
        } else if (isAuthenticated === false) {
          const savedBookmarks = getBookmarkedCreators();
          setBookmarks(savedBookmarks.map(bookmark => ({
            ...bookmark,
            userId: 'anonymous',
            bookmarkedAt: bookmark.bookmarkedAt || new Date().toISOString()
          })));
        }
      } catch (error) {
        console.error('Error loading bookmarks:', error);
      } finally {
        setLoading(false);
      }
    };

    // Only load when we have a definitive auth state
    if (isAuthenticated !== null) {
      loadBookmarks();
    }
  }, [isAuthenticated, user]);

  // Load growth data for bookmarks with better performance
  useEffect(() => {
    const loadGrowthData = async () => {
      // Only run client-side and when we have bookmarks
      if (typeof window === 'undefined' || bookmarks.length === 0) {
        return;
      }
      
      setIsLoadingGrowthData(true);
      
      // Check localStorage cache first
      const CACHE_KEY = 'gabooja_bookmark_growth_cache';
      const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache
      
      try {
        const cachedData = localStorage.getItem(CACHE_KEY);
        if (cachedData) {
          const { data, timestamp } = JSON.parse(cachedData);
          if (Date.now() - timestamp < CACHE_DURATION) {
            setBookmarkGrowthData(data);
            setIsLoadingGrowthData(false);
            return;
          }
        }
      } catch (error) {
        console.error('Error loading cached growth data:', error);
      }
      
      const growthDataMap: Record<string, { previousFollowerCount: number; growthPercentage: number; lastAnalyzed: string }> = {};
      
      try {
        // Process bookmarks in batches for better performance
        const batchSize = 3;
        for (let i = 0; i < bookmarks.length; i += batchSize) {
          const batch = bookmarks.slice(i, i + batchSize);
          
          await Promise.all(batch.map(async (bookmark) => {
            try {
              // Get the creator ID from creators table
              const { data: creators, error: creatorError } = await supabase
                .from('creators')
                .select('id')
                .eq('username', bookmark.username)
                .eq('platform', bookmark.platform)
                .limit(1)
                .single();
              
              if (creatorError || !creators) {
                return;
              }

              // Get the two most recent analyses for growth calculation
              const { data: allAnalyses, error: allAnalysesError } = await supabase
                .from('creator_analyses')
                .select('follower_count, created_at')
                .eq('creator_id', creators.id)
                .order('created_at', { ascending: false })
                .limit(2);

              if (allAnalysesError || !allAnalyses || allAnalyses.length < 2) {
                return;
              }

              const currentAnalysis = allAnalyses[0];
              const previousAnalysis = allAnalyses[1];

              const currentCount = currentAnalysis.follower_count;
              const previousCount = previousAnalysis.follower_count;
              
              if (currentCount && previousCount && previousCount > 0) {
                const growthPercentage = ((currentCount - previousCount) / previousCount) * 100;
                
                const key = `${bookmark.username}_${bookmark.platform}`;
                growthDataMap[key] = {
                  previousFollowerCount: previousCount,
                  growthPercentage: Number(growthPercentage.toFixed(2)),
                  lastAnalyzed: currentAnalysis.created_at
                };
              }
            } catch (error) {
              console.error(`Error processing ${bookmark.username}@${bookmark.platform}:`, error);
            }
          }));
          
          // Update UI progressively as batches complete
          if (Object.keys(growthDataMap).length > 0) {
            setBookmarkGrowthData(prev => ({ ...prev, ...growthDataMap }));
          }
        }
      } catch (error) {
        console.error('Error in batch growth data fetch:', error);
      }
      
      // Cache the final results
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          data: growthDataMap,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.error('Error caching growth data:', error);
      }
      
      setIsLoadingGrowthData(false);
    };
    
    // Load growth data immediately when bookmarks are available
    if (bookmarks.length > 0) {
      loadGrowthData();
    }
  }, [bookmarks]);

  // Monitor for category updates and refresh bookmarks when needed
  useEffect(() => {
    const checkForCategoryUpdates = () => {
      if (typeof window === 'undefined') return;
      
      try {
        const timestamp = localStorage.getItem('gabooja_category_update_timestamp');
        if (timestamp) {
          const updateTime = parseInt(timestamp);
          if (updateTime > categoryUpdateTimestamp) {
            setCategoryUpdateTimestamp(updateTime);
            
            // Refresh bookmarks to get updated categories
            const refreshBookmarks = async () => {
              if (isAuthenticated && user) {
                const userBookmarks = await UserBookmarksService.getUserBookmarks(user.id);
                setBookmarks(userBookmarks);
              } else if (isAuthenticated === false) {
                const savedBookmarks = getBookmarkedCreators();
                setBookmarks(savedBookmarks.map(bookmark => ({
                  ...bookmark,
                  userId: 'anonymous',
                  bookmarkedAt: bookmark.bookmarkedAt || new Date().toISOString()
                })));
              }
            };
            
            refreshBookmarks();
          }
        }
      } catch (error) {
        console.log('Error checking for category updates:', error);
      }
    };
    
    // Check for updates every 2 seconds when page is visible
    const interval = setInterval(checkForCategoryUpdates, 2000);
    
    // Also check immediately when component mounts
    checkForCategoryUpdates();
    
    return () => clearInterval(interval);
  }, [categoryUpdateTimestamp, isAuthenticated, user]);

  const handleDeleteClick = (bookmark: UserBookmark) => {
    // Check if user has disabled confirmation modal
    const skipConfirmation = localStorage.getItem('gabooja_skip_delete_confirmation') === 'true';
    
    if (skipConfirmation) {
      // Skip modal and delete directly
      setSelectedBookmark(bookmark);
      handleConfirmDelete();
    } else {
      // Show confirmation modal
      setSelectedBookmark(bookmark);
      setShowDeleteModal(true);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedBookmark) return;
    
    if (isAuthenticated && user) {
      UserBookmarksService.removeUserBookmark(user.id, selectedBookmark.username, selectedBookmark.platform as 'instagram' | 'tiktok');
    } else {
      removeBookmark(selectedBookmark.platform as 'instagram' | 'tiktok', selectedBookmark.username);
    }
    
    // Update local state
    setBookmarks(prev => prev.filter(b => !(b.platform === selectedBookmark.platform && b.username === selectedBookmark.username)));
    setSelectedBookmark(null);
  };

  const handleEditNotes = (bookmark: UserBookmark) => {
    setSelectedBookmark(bookmark);
    setShowCommentModal(true);
  };

  const handleSaveComments = async (comments: string) => {
    if (!selectedBookmark) return;
    
    try {
      if (isAuthenticated && user) {
        UserBookmarksService.updateUserBookmarkComments(
          user.id,
          selectedBookmark.username,
          selectedBookmark.platform as 'instagram' | 'tiktok',
          comments
        );
      } else {
        updateBookmarkComments(selectedBookmark.platform as 'instagram' | 'tiktok', selectedBookmark.username, comments);
      }
      
      // Update local state
      setBookmarks(prev => prev.map(b => 
        b.platform === selectedBookmark.platform && b.username === selectedBookmark.username
          ? { ...b, comments }
          : b
      ));
    } catch (error) {
      console.error('Error saving bookmark comments:', error);
    }
  };


  const handleViewAnalysis = async (bookmark: UserBookmark) => {
    // OPTIMIZATION: Use cached analysis date if available from growth data load
    const key = `${bookmark.username}_${bookmark.platform}`;
    const actualAnalysisDate = bookmarkGrowthData[key]?.lastAnalyzed || bookmark.bookmarkedAt;
    
    // Convert bookmark data to complete analysis format - ensure ALL fields are populated
    const analysisData: AnalysisData = {
      profile: {
        username: bookmark.username,
        platform: bookmark.platform as 'instagram' | 'tiktok',
        displayName: bookmark.displayName,
        bio: bookmark.bio,
        profileImageUrl: bookmark.profileImageUrl || '',
        isVerified: bookmark.isVerified,
        followerCount: bookmark.followerCount,
        followingCount: bookmark.followingCount,
        location: bookmark.location, // Add missing location field
        website: bookmark.website,
        metrics: {
          followerCount: bookmark.followerCount,
          followingCount: bookmark.followingCount,
          postCount: bookmark.metrics?.postCount,
          engagementRate: bookmark.metrics?.engagementRate,
          likeCount: bookmark.metrics?.likeCount,
          videoCount: bookmark.metrics?.videoCount,
          averageViews: bookmark.metrics?.averageViews,
          averageLikes: bookmark.metrics?.averageLikes,
          ...bookmark.metrics // Spread any other metrics
        },
        aiAnalysis: bookmark.aiAnalysis ? {
          creator_score: bookmark.aiAnalysis.creator_score || '0',
          category: bookmark.aiAnalysis.category || 'other',
          brand_potential: bookmark.aiAnalysis.brand_potential || 'Not analyzed',
          key_strengths: bookmark.aiAnalysis.key_strengths || 'Not analyzed',
          engagement_quality: bookmark.aiAnalysis.engagement_quality || 'Not analyzed',
          content_style: bookmark.aiAnalysis.content_style || 'Not analyzed',
          audience_demographics: bookmark.aiAnalysis.audience_demographics || 'Not analyzed',
          collaboration_potential: bookmark.aiAnalysis.collaboration_potential || 'Not analyzed',
          overall_assessment: bookmark.aiAnalysis.overall_assessment || 'Creator profile analysis'
        } : {
          creator_score: '0',
          category: 'other',
          brand_potential: 'Not analyzed',
          key_strengths: 'Not analyzed',
          engagement_quality: 'Not analyzed',
          content_style: 'Not analyzed',
          audience_demographics: 'Not analyzed',
          collaboration_potential: 'Not analyzed',
          overall_assessment: 'Creator profile - analysis pending'
        },
      },
      scrapingDetails: {
        method: 'Bookmarked Creator',
        timestamp: bookmark.bookmarkedAt,
      },
      // Add missing fields that Analysis Modal expects
      growthData: undefined, // TODO: Could add growth data for bookmarks in the future
      lastAnalyzed: actualAnalysisDate, // Use actual analysis date or fallback to bookmark date
      cached: true, // Bookmark data is considered cached
    };

    // OPTIMIZATION: Only enrich if absolutely necessary and use lazy loading
    const needsEnrichment = !bookmark.aiAnalysis || (
      !bookmark.aiAnalysis.brand_potential ||
      !bookmark.aiAnalysis.key_strengths ||
      !bookmark.aiAnalysis.engagement_quality ||
      !bookmark.aiAnalysis.content_style ||
      !bookmark.aiAnalysis.audience_demographics ||
      !bookmark.aiAnalysis.collaboration_potential ||
      !bookmark.aiAnalysis.overall_assessment
    );

    // Add growth data from our batch-loaded cache if available
    const growthKey = `${bookmark.username}_${bookmark.platform}`;
    if (bookmarkGrowthData[growthKey]) {
      analysisData.growthData = {
        previousFollowerCount: bookmarkGrowthData[growthKey].previousFollowerCount,
        growthPercentage: bookmarkGrowthData[growthKey].growthPercentage
      };
    }

    if (needsEnrichment) {
      // OPTIMIZATION: Show modal first with basic data, then enrich in background
      setSelectedAnalysis(analysisData);
      setIsModalOpen(true);
      
      try {
        // Fetch complete analysis data from database using client (background)
        const { data, error } = await supabase
          .from('creator_discovery_enriched')
          .select('*')
          .eq('username', bookmark.username)
          .eq('platform', bookmark.platform)
          .order('last_analysis_date', { ascending: false })
          .limit(1)
          .single();
        
        if (!error && data) {
          const enrichedAnalysisData = {
            profile: {
              username: data.username || bookmark.username,
              platform: data.platform as 'instagram' | 'tiktok',
              displayName: data.display_name || bookmark.displayName,
              bio: data.bio || bookmark.bio,
              profileImageUrl: data.profile_image_url || bookmark.profileImageUrl || '',
              isVerified: data.is_verified || bookmark.isVerified,
              followerCount: data.follower_count || bookmark.followerCount,
              followingCount: data.following_count || bookmark.followingCount,
              location: data.location || bookmark.location,
              website: data.website || bookmark.website,
              metrics: {
                followerCount: data.follower_count,
                followingCount: data.following_count,
                postCount: data.post_count,
                engagementRate: data.engagement_rate,
                likeCount: data.like_count,
                videoCount: data.video_count,
                averageViews: data.average_views,
                averageLikes: data.average_likes,
              },
              aiAnalysis: {
                creator_score: data.creator_score || '0',
                category: data.category || 'other',
                brand_potential: data.brand_potential || 'Not analyzed',
                key_strengths: data.key_strengths || 'Not analyzed',
                engagement_quality: data.engagement_quality || 'Not analyzed',
                content_style: data.content_style || 'Not analyzed',
                audience_demographics: data.audience_demographics || 'Not analyzed',
                collaboration_potential: data.collaboration_potential || 'Not analyzed',
                overall_assessment: data.overall_assessment || 'Creator profile analysis'
              }
            },
            scrapingDetails: {
              method: 'From Database',
              timestamp: data.last_analysis_date || actualAnalysisDate,
            },
            growthData: data.growth_percentage !== null ? {
              previousFollowerCount: data.previous_follower_count || 0,
              growthPercentage: data.growth_percentage || 0,
            } : bookmarkGrowthData[growthKey] ? {
              previousFollowerCount: bookmarkGrowthData[growthKey].previousFollowerCount,
              growthPercentage: bookmarkGrowthData[growthKey].growthPercentage
            } : undefined,
            lastAnalyzed: data.last_analysis_date || actualAnalysisDate,
            cached: true
          };
          
          // Update the modal with enriched data
          setSelectedAnalysis(enrichedAnalysisData);
        }
      } catch (error) {
        console.error('Error enriching analysis from database:', error);
      }
      return; // Early return since we already opened the modal
    }

    setSelectedAnalysis(analysisData);
    setIsModalOpen(true);
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

  const handleGrowthChart = (bookmark: UserBookmark) => {
    setSelectedBookmarkForGrowth(bookmark);
    setShowGrowthChart(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading bookmarks...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold gabooja-gradient">Your Bookmarked Creators</h1>
        <p className="text-muted-foreground">
          Creators you&apos;ve analyzed and saved for future reference
        </p>
      </div>

      <Card className="gabooja-card">
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 py-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total saved</p>
            <p className="text-2xl font-semibold">{bookmarks.length}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg followers</p>
            <p className="text-2xl font-semibold">{formatNumber(Math.round(averageFollowers))}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Verified creators</p>
            <p className="text-2xl font-semibold">{verifiedCount}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg growth*</p>
            <p className="text-2xl font-semibold">
              {averageGrowth === 0 && filteredCount === 0 ? '—' : formatGrowthValue(averageGrowth)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">*Based on creators with growth data</p>
          </div>
        </CardContent>
      </Card>

      {bookmarks.length > 0 && (
        <Card className="gabooja-card">
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'All platforms', value: 'all' },
                { label: 'Instagram', value: 'instagram' },
                { label: 'TikTok', value: 'tiktok' },
              ].map((option) => (
                <Button
                  key={option.value}
                  variant={platformFilter === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPlatformFilter(option.value as 'all' | 'instagram' | 'tiktok')}
                  className="text-xs"
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                Sort by
                <select
                  className="rounded-lg border border-border bg-transparent px-2 py-1 text-sm"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as 'recent' | 'followers' | 'growth')}
                >
                  <option value="recent">Recently saved</option>
                  <option value="followers">Followers (desc)</option>
                  <option value="growth">Growth momentum</option>
                </select>
              </div>
              <div className="relative flex-1 min-w-[200px]">
                <Input
                  placeholder="Search by username or name"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pr-10"
                />
                {searchTerm && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="text-xs text-muted-foreground ml-auto">
                Showing {filteredCount} of {bookmarks.length}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {bookmarks.length === 0 ? (
        <Card className="gabooja-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold mb-2">No bookmarks yet</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Start analyzing creators and bookmark them to see them here. 
              Use the bookmark button on any analyzed creator profile.
            </p>
          </CardContent>
        </Card>
      ) : filteredCount === 0 ? (
        <Card className="gabooja-card">
          <CardContent className="py-10 text-center text-muted-foreground">
            <p>No creators match your current filters.</p>
            <p className="text-sm mt-2">Try adjusting the platform filter or clearing the search.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBookmarks.map((bookmark) => (
            <Card key={bookmark.id} className="gabooja-card">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold">
                          @{bookmark.username}
                        </span>
                        {bookmark.isVerified && (
                          <span className="text-primary">✓</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          bookmark.platform === 'instagram' 
                            ? 'bg-[#ff5c8f] text-white'
                            : bookmark.platform === 'tiktok'
                            ? 'bg-secondary text-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {bookmark.platform}
                        </span>
                        {bookmark.aiAnalysis?.category && (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(bookmark.aiAnalysis.category)}`}>
                            {bookmark.aiAnalysis.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteClick(bookmark)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  Bookmarked {formatDate(bookmark.bookmarkedAt)}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Website */}
                {bookmark.website && (
                  <a
                    href={bookmark.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    <Link className="h-3 w-3" />
                    {bookmark.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                
                {/* Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold gabooja-accent">
                      {formatNumber(bookmark.followerCount)}
                    </div>
                    <div className="text-xs text-muted-foreground">Followers</div>
                    {(() => {
                      const key = `${bookmark.username}_${bookmark.platform}`;
                      const growthData = bookmarkGrowthData[key];
                      return growthData ? (
                        <div className="mt-1">
                          <button
                            onClick={() => handleGrowthChart(bookmark)}
                            className={`text-xs px-2 py-1 rounded-full inline-flex items-center gap-1 cursor-pointer hover:ring-2 hover:ring-offset-1 transition-all duration-200 ${
                              growthData.growthPercentage > 0
                                ? 'bg-green-200/20 text-green-300 hover:ring-green-400/30'
                                : growthData.growthPercentage < 0
                                ? 'bg-red-200/20 text-red-300 hover:ring-red-400/30'
                                : 'bg-muted text-muted-foreground hover:ring-muted/40'
                            }`}
                            title={`Click to view growth chart • Previous: ${formatNumber(growthData.previousFollowerCount)}`}
                          >
                            {growthData.growthPercentage > 0 ? '📈' : growthData.growthPercentage < 0 ? '📉' : '➖'}
                            <span>
                              {growthData.growthPercentage > 0 ? '+' : ''}
                              {growthData.growthPercentage.toFixed(1)}%
                            </span>
                          </button>
                        </div>
                      ) : isLoadingGrowthData ? (
                        <div className="mt-1 text-xs text-muted-foreground animate-pulse">
                          Loading...
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-muted-foreground">
                          No growth data
                        </div>
                      );
                    })()}
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">
                      {formatNumber(bookmark.followingCount)}
                    </div>
                    <div className="text-xs text-muted-foreground">Following</div>
                  </div>
                </div>

                {/* Growth Trend Analysis Section */}
                {(() => {
                  const key = `${bookmark.username}_${bookmark.platform}`;
                  const growthData = bookmarkGrowthData[key];
                  return growthData && (
                    <div className="p-3 rounded-lg border border-border bg-gradient-to-r from-[#0f0f0f] to-[#151515]">
                      <div className="text-xs font-medium text-primary mb-2 flex items-center gap-1">
                        📊 Growth Trend Analysis
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                              growthData.growthPercentage > 0
                                ? 'bg-green-200/20 text-green-300'
                                : growthData.growthPercentage < 0
                                ? 'bg-red-200/20 text-red-300'
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {growthData.growthPercentage > 0 ? '🚀' : growthData.growthPercentage < 0 ? '📉' : '➖'}
                              {growthData.growthPercentage > 0 ? '+' : ''}{growthData.growthPercentage.toFixed(1)}%
                            </span>
                            <span className="text-xs text-muted-foreground">
                              vs. {formatNumber(growthData.previousFollowerCount)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Last analyzed: {new Date(growthData.lastAnalyzed).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          onClick={() => handleGrowthChart(bookmark)}
                          className="px-3 py-1 text-xs bg-primary hover:bg-primary/90 text-primary-foreground rounded-full transition-colors duration-200 flex items-center gap-1 cursor-pointer"
                          title="View detailed growth chart"
                        >
                          📈 View Chart
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* AI Analysis Score if available */}
                {bookmark.aiAnalysis && (
                  <div className="p-3 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
                    <div className="text-xs font-medium gabooja-accent mb-1">Creator Score</div>
                    <div className="text-sm font-bold gabooja-accent">
                      {(() => {
                        const scoreText = bookmark.aiAnalysis.creator_score;
                        const scoreMatch = scoreText.match(/^(\d+(?:\.\d+)?(?:\/\d+)?)/);
                        return scoreMatch ? scoreMatch[1] : scoreText;
                      })()}
                    </div>
                  </div>
                )}

                {/* User Notes if available */}
                {bookmark.comments && (
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                    <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1 flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      Your Notes
                    </div>
                    <div className="text-sm text-blue-600 dark:text-blue-400 line-clamp-3">
                      {bookmark.comments}
                    </div>
                  </div>
                )}
                
                {/* Action Buttons */}
                <div className="pt-2 border-t border-border space-y-2">
                  {/* Action Buttons in one row */}
                  <div className="flex gap-2">
                    {/* View Analysis */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewAnalysis(bookmark)}
                      className="flex-1 flex items-center gap-2 text-xs hover:bg-primary/10 hover:text-foreground hover:border-primary/30 transition-all duration-200"
                    >
                      <Eye className="h-3 w-3" />
                      View Analysis
                    </Button>

                    {/* Edit Notes */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditNotes(bookmark)}
                      className="flex-1 flex items-center gap-2 text-xs hover:bg-primary/10 hover:text-foreground hover:border-primary/30 transition-all duration-200"
                    >
                      <Edit3 className="h-3 w-3" />
                      {bookmark.comments ? 'Edit Notes' : 'Add Notes'}
                    </Button>
                  </div>
                  
                  {/* Profile Link */}
                  <a
                    href={
                      bookmark.platform === 'tiktok' 
                        ? `https://www.tiktok.com/@${bookmark.username}`
                        : `https://www.${bookmark.platform}.com/${bookmark.username}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-medium text-sm w-full justify-center"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View Profile
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
      {selectedBookmark && (
        <BookmarkCommentModal
          isOpen={showCommentModal}
          onClose={() => {
            setShowCommentModal(false);
            setSelectedBookmark(null);
          }}
          onSave={handleSaveComments}
          creatorUsername={selectedBookmark.username}
          platform={selectedBookmark.platform}
          initialComments={selectedBookmark.comments || ''}
          isEditing={!!selectedBookmark.comments}
        />
      )}

      {/* Delete Confirmation Modal */}
      {selectedBookmark && (
        <DeleteConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedBookmark(null);
          }}
          onConfirm={handleConfirmDelete}
          creatorUsername={selectedBookmark.username}
          platform={selectedBookmark.platform}
        />
      )}

      {/* Growth Chart Modal */}
      {selectedBookmarkForGrowth && (
        <GrowthChartModal
          creator={{
            username: selectedBookmarkForGrowth.username,
            platform: selectedBookmarkForGrowth.platform,
            displayName: selectedBookmarkForGrowth.displayName
          }}
          isOpen={showGrowthChart}
          onClose={() => {
            setShowGrowthChart(false);
            setSelectedBookmarkForGrowth(null);
          }}
        />
      )}
    </div>
  );
} 