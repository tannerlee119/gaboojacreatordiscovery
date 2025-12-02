"use client";

import { useState, useEffect, useCallback, useDeferredValue, useTransition, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Platform } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import { addBookmark, removeBookmark, isBookmarked, BookmarkedCreator, updateBookmarkComments } from '@/lib/bookmarks';
import { UserBookmarksService } from '@/lib/user-bookmarks';
import { useSupabaseAuth } from '@/lib/supabase-auth-context';
import { useCreator } from '@/lib/creator-context';
import { BookmarkCommentModal } from '@/components/ui/bookmark-comment-modal';
import { CategoryEditor } from '@/components/ui/category-editor';
import { GrowthChartModal } from '@/components/features/growth-chart-modal';
import { CreatorMatchingModal } from '@/components/features/creator-matching-modal';
import { CreatorCategory } from '@/lib/types';
import Image from 'next/image';
import { ChevronDown, ChevronRight, ExternalLink, Link, Bookmark, BookmarkCheck, RefreshCw, TrendingUp, Users, Loader2 } from 'lucide-react';

const platforms: { value: Platform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
];

interface AnalysisResult {
  profile: {
    username: string;
    platform: Platform;
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
      // TikTok-specific metrics
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
  aiMetrics?: {
    model: string;
    cost: number;
    cached: boolean;
  };
  dataQuality?: {
    score: number;
    isValid: boolean;
    breakdown: {
      completeness: number;
      consistency: number;
      reliability: number;
    };
    issues: Array<{
      field: string;
      message: string;
      severity: 'critical' | 'warning' | 'info';
    }>;
    transformations: number;
    recommendations: string[];
  };
  growthData?: {
    previousFollowerCount: number;
    growthPercentage: number;
  };
  lastAnalyzed?: string;
  cached?: boolean;
}

// Type guard functions
function hasAiMetrics(result: AnalysisResult): result is AnalysisResult & { aiMetrics: NonNullable<AnalysisResult['aiMetrics']> } {
  return 'aiMetrics' in result && result.aiMetrics !== undefined;
}

function hasDataQuality(result: AnalysisResult): result is AnalysisResult & { dataQuality: NonNullable<AnalysisResult['dataQuality']> } {
  return 'dataQuality' in result && result.dataQuality !== undefined;
}

export function CreatorAnalyzer() {
  const {
    currentAnalysis,
    setCurrentAnalysis,
    addToHistory,
    analysisHistory,
    isLoading,
    setIsLoading,
  } = useCreator();
  const { user, session } = useSupabaseAuth();
  const isAuthenticated = !!session;
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const deferredUsername = useDeferredValue(username);
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [error, setError] = useState<string | null>(null);
  const [isScreenshotOpen, setIsScreenshotOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [bookmarkedStatus, setBookmarkedStatus] = useState<boolean>(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showGrowthChart, setShowGrowthChart] = useState(false);
  const [showCreatorMatching, setShowCreatorMatching] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<string>('other');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusStep, setStatusStep] = useState<'idle' | 'scraping' | 'ai' | 'complete'>('idle');
  const [statusMessage, setStatusMessage] = useState('Ready to analyze');
  const [isPending, startTransition] = useTransition();
  const busyAnalyzing = isLoading || isPending;
  
  // Cache for storing last results per platform
  const [resultCache, setResultCache] = useState<{
    [key in Platform]?: AnalysisResult
  }>({});
  const statusRank = useMemo(
    () => ({
      idle: 0,
      scraping: 1,
      ai: 2,
      complete: 3,
    }),
    []
  );
  const progressSteps = useMemo(
    () => [
      {
        id: 'scraping',
        title: 'Scraping profile',
        description: 'Collecting public metrics via Playwright',
      },
      {
        id: 'ai',
        title: 'AI insights',
        description: 'Summarizing content with GPT-4o mini',
      },
      {
        id: 'complete',
        title: 'Report ready',
        description: 'Bookmark or refresh as needed',
      },
    ],
    []
  );

  // Use current analysis from context
  const result = currentAnalysis;

  // Restore username and platform from current analysis when component mounts or analysis changes
  useEffect(() => {
    if (result && !username.trim()) {
      setUsername(result.profile.username);
      setPlatform(result.profile.platform);
    }
  }, [result, username]);

  const executeAnalysis = useCallback(async (forceRefresh = false) => {
    if (!username.trim()) return;
    
    setIsLoading(true);
    if (forceRefresh) {
      setIsRefreshing(true);
    }
    setError(null);
    if (!forceRefresh) {
      setCurrentAnalysis(null);
    }
    setStatusStep('scraping');
    setStatusMessage(forceRefresh ? 'Refreshing live metrics...' : 'Launching browser & gathering profile data...');
    
    try {
      
      const requestBody = { 
        username: username.trim(), 
        platform,
        forceRefresh 
      };
      
      const response = await fetch('/api/analyze-creator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      setStatusStep('ai');
      setStatusMessage('Synthesizing AI insights...');
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Analysis failed');
      }

      const newResult = data.data;
      setCurrentAnalysis(newResult);
      addToHistory(newResult);
      
      // Add to user's recent searches if authenticated
      if (isAuthenticated && user) {
        UserBookmarksService.addUserRecentSearch(
          user.id,
          username,
          platform as 'instagram' | 'tiktok',
          newResult
        );
      }
      
      // Cache the result for this platform
      setResultCache(prev => ({
        ...prev,
        [platform]: newResult
      }));
      setStatusStep('complete');
      setStatusMessage('Report ready');
      setTimeout(() => {
        setStatusStep('idle');
        setStatusMessage('Ready to analyze');
      }, 1500);
      
      
    } catch (error) {
      console.error('Analysis failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Provide more helpful error messages for common issues
      if (errorMessage.includes('Rate limit exceeded')) {
        setError('⏰ You\'ve made too many requests recently. Please wait a few minutes before trying again.');
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('network')) {
        setError('🌐 Network error. Please check your connection and try again.');
      } else {
        setError(errorMessage);
      }
      setStatusStep('idle');
      setStatusMessage('Unable to analyze. Please try again.');
    } finally {
      setIsLoading(false);
      if (forceRefresh) {
        setIsRefreshing(false);
      }
    }
  }, [username, platform, setIsLoading, setCurrentAnalysis, addToHistory, isAuthenticated, user, setResultCache]);

  const handleAnalyze = useCallback((forceRefresh = false) => {
    startTransition(() => {
      void executeAnalysis(forceRefresh);
    });
  }, [executeAnalysis]);

  // Handle URL parameters for auto-analysis (from bookmarks refresh)
  useEffect(() => {
    const urlUsername = searchParams.get('username');
    const urlPlatform = searchParams.get('platform') as Platform;
    const shouldRefresh = searchParams.get('refresh') === 'true';
    
    if (urlUsername && urlPlatform) {
      setUsername(urlUsername);
      setPlatform(urlPlatform);
      
      // Trigger analysis automatically with force refresh if requested
      const timer = setTimeout(() => {
        handleAnalyze(shouldRefresh);
      }, 100); // Small delay to ensure state is set
      
      return () => clearTimeout(timer);
    }
  }, [searchParams, handleAnalyze]); // Include handleAnalyze in dependencies

  // Check bookmark status when result changes
  useEffect(() => {
    const checkBookmarkStatus = async () => {
      if (result && user) {
        if (isAuthenticated) {
          const bookmarked = await UserBookmarksService.isUserBookmarked(user.id, result.profile.username, result.profile.platform as 'instagram' | 'tiktok');
          setBookmarkedStatus(bookmarked);
        } else {
          setBookmarkedStatus(isBookmarked(result.profile.platform, result.profile.username));
        }
      } else {
        setBookmarkedStatus(false);
      }
    };

    checkBookmarkStatus();
  }, [result, user, isAuthenticated]);

  // Update category when result changes
  useEffect(() => {
    if (result?.profile.aiAnalysis?.category) {
      setCurrentCategory(result.profile.aiAnalysis.category);
    }
  }, [result]);

  // Handle platform switching - restore cached result if available
  const handlePlatformChange = (newPlatform: Platform) => {
    setPlatform(newPlatform);
    setError(null);
    
    // Check if we have a cached result for this platform
    const cachedResult = resultCache[newPlatform];
    if (cachedResult) {
      setCurrentAnalysis(cachedResult);
      // Update username to match the cached result
      setUsername(cachedResult.profile.username);
    } else {
      // Clear result if no cached data
      setCurrentAnalysis(null);
      setUsername('');
    }
  };

  // Handle bookmark toggle
  const handleBookmarkToggle = async () => {
    if (!result || !user) return;

    if (bookmarkedStatus) {
      // Remove bookmark
      if (isAuthenticated) {
        await UserBookmarksService.removeUserBookmark(user.id, result.profile.username, result.profile.platform as 'instagram' | 'tiktok');
      } else {
        removeBookmark(result.profile.platform, result.profile.username);
      }
      setBookmarkedStatus(false);
    } else {
      // Add bookmark
      const bookmarkData: BookmarkedCreator = {
        id: Date.now().toString(),
        username: result.profile.username,
        platform: result.profile.platform,
        displayName: result.profile.displayName,
        profileImageUrl: result.profile.profileImageUrl,
        isVerified: result.profile.isVerified,
        followerCount: result.profile.followerCount,
        followingCount: result.profile.followingCount,
        website: result.profile.website,
        bio: result.profile.bio,
        metrics: result.profile.metrics,
        aiAnalysis: result.profile.aiAnalysis,
        bookmarkedAt: new Date().toISOString(),
      };
      
      if (isAuthenticated) {
        await UserBookmarksService.addUserBookmark(user.id, bookmarkData);
      } else {
        addBookmark(bookmarkData);
      }
      setBookmarkedStatus(true);
      
      // Show comment modal after bookmarking
      setShowCommentModal(true);
    }
  };

  const handleSaveComments = async (comments: string) => {
    if (!result || !user) return;
    
    try {
      if (isAuthenticated) {
        await UserBookmarksService.updateUserBookmarkComments(
          user.id,
          result.profile.username,
          result.profile.platform as 'instagram' | 'tiktok',
          comments
        );
      } else {
        updateBookmarkComments(result.profile.platform, result.profile.username, comments);
      }
    } catch (error) {
      console.error('Error saving bookmark comments:', error);
    }
  };

  const handleCategoryChange = (newCategory: CreatorCategory) => {
    setCurrentCategory(newCategory);
    // You could add API call here to save the category change to database
    console.log(`Category changed from ${currentCategory} to ${newCategory} for @${result?.profile.username}`);
  };

  return (
    <div className="space-y-6">
      <Card className="gabooja-card">
        <CardHeader>
          <CardTitle className="text-2xl">Creator Analyzer</CardTitle>
          <CardDescription>
            Enter a creator&apos;s username to analyze their profile with AI-powered insights
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <Input
                  placeholder="username (without @)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  disabled={busyAnalyzing}
                  className="pl-8"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {deferredUsername
                  ? `Analyzing @${deferredUsername} on ${platform}.`
                  : 'Type a public Instagram or TikTok username.'}
              </p>
            </div>
            <div className="flex gap-2">
              {platforms.map((p) => (
                <Button
                  key={p.value}
                  variant={platform === p.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePlatformChange(p.value)}
                  className={`flex-1 text-xs transition-all duration-200 ${
                    platform === p.value
                      ? ''
                      : 'hover:bg-primary/10 hover:text-foreground hover:border-primary/30'
                  }`}
                  disabled={busyAnalyzing}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <Button
            onClick={() => handleAnalyze()}
            disabled={!username.trim() || busyAnalyzing}
            size="lg"
            className="w-full cursor-pointer hover:bg-primary/90 transition-colors duration-200 disabled:cursor-not-allowed"
          >
            {busyAnalyzing ? (
              <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Analyzing... (30-60s)
              </span>
            ) : (
              'Analyze Creator'
            )}
          </Button>

          <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 flex items-center gap-3 text-sm text-muted-foreground">
            {busyAnalyzing ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
            )}
            <span>{statusMessage}</span>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {progressSteps.map((step) => {
              const rank = statusRank[step.id as keyof typeof statusRank];
              const isActive = statusRank[statusStep] >= rank && statusStep !== 'idle';
              return (
                <div
                  key={step.id}
                  className={`rounded-2xl border px-4 py-3 text-sm transition-colors ${
                    isActive
                      ? 'border-primary/60 bg-primary/5 text-foreground'
                      : 'border-border/60 text-muted-foreground'
                  }`}
                >
                  <div className="font-medium flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                    {step.title}
                  </div>
                  <p className="mt-1 text-xs">{step.description}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {analysisHistory.length > 0 && (
        <Card className="gabooja-card">
          <CardHeader>
            <CardTitle className="text-base">Recent runs</CardTitle>
            <CardDescription>Re-load a previous analysis in one click</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {analysisHistory.slice(0, 3).map((entry) => (
              <div
                key={`${entry.profile.username}-${entry.profile.platform}`}
                className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-sm"
              >
                <div className="flex flex-col">
                  <span className="font-medium">@{entry.profile.username}</span>
                  <span className="text-xs text-muted-foreground capitalize">{entry.profile.platform}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs hover:bg-primary/10 hover:text-foreground hover:border-primary/30"
                  onClick={() => {
                    setUsername(entry.profile.username);
                    setPlatform(entry.profile.platform);
                    handleAnalyze();
                  }}
                  disabled={busyAnalyzing}
                >
                  Re-run
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive">Analysis Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-6">
          {/* Profile Overview */}
          <Card className="gabooja-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      @{result.profile.username}
                      {result.profile.isVerified && (
                        <span className="text-primary">✓</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        result.profile.platform === 'instagram' 
                          ? 'bg-[#ff5c8f] text-white'
                      : result.profile.platform === 'tiktok'
                      ? 'bg-secondary text-foreground'
                      : 'bg-muted text-muted-foreground'
                      }`}>
                        {result.profile.platform}
                      </span>
                      {result.lastAnalyzed && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-accent text-accent-foreground">
                          📊 Analyzed {(() => {
                            const analysisAge = Date.now() - new Date(result.lastAnalyzed).getTime();
                            const ageInDays = Math.floor(analysisAge / (1000 * 60 * 60 * 24));
                            const ageInHours = Math.floor(analysisAge / (1000 * 60 * 60));
                            const ageInMinutes = Math.floor(analysisAge / (1000 * 60));
                            
                            if (ageInDays > 0) {
                              return `${ageInDays} day${ageInDays > 1 ? 's' : ''} ago`;
                            } else if (ageInHours > 0) {
                              return `${ageInHours} hour${ageInHours > 1 ? 's' : ''} ago`;
                            } else if (ageInMinutes > 0) {
                              return `${ageInMinutes} minute${ageInMinutes > 1 ? 's' : ''} ago`;
                            } else {
                              return 'just now';
                            }
                          })()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAnalyze(true)}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 text-xs hover:bg-primary/10 hover:text-foreground hover:border-primary/30 transition-all duration-200"
                  >
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? 'Refreshing...' : 'Refresh'}
                  </Button>
                  <Button
                    variant={bookmarkedStatus ? "default" : "outline"}
                    size="sm"
                    onClick={handleBookmarkToggle}
                    className="flex items-center gap-2 text-xs hover:bg-primary/10 hover:text-foreground hover:border-primary/30 transition-all duration-200"
                  >
                    {bookmarkedStatus ? (
                      <>
                        <BookmarkCheck className="h-4 w-4" />
                        Bookmarked
                      </>
                    ) : (
                      <>
                        <Bookmark className="h-4 w-4" />
                        Bookmark
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowGrowthChart(true)}
                    className="flex items-center gap-2 text-xs hover:bg-primary/10 hover:text-foreground hover:border-primary/30 transition-all duration-200"
                  >
                    <TrendingUp className="h-4 w-4" />
                    Growth Chart
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreatorMatching(true)}
                    className="flex items-center gap-2 text-xs hover:bg-primary/10 hover:text-foreground hover:border-primary/30 transition-all duration-200"
                  >
                    <Users className="h-4 w-4" />
                    Find Match
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(result.profile.bio && result.profile.platform === 'tiktok') && (
                <div className="space-y-2">
                  <p className="text-sm leading-relaxed">{result.profile.bio}</p>
                </div>
              )}
              
              {result.profile.website && (
                <div className="space-y-2">
                  <a
                    href={result.profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    <Link className="h-3 w-3" />
                    {result.profile.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold gabooja-accent">
                    {formatNumber(result.profile.followerCount)}
                  </div>
                  <div className="text-sm text-muted-foreground">Followers</div>
                  {result.growthData && (
                    <button
                      onClick={() => setShowGrowthChart(true)}
                      className={`text-xs px-2 py-1 rounded-full mt-1 transition-colors hover:opacity-80 cursor-pointer ${
                        result.growthData.growthPercentage > 0
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : result.growthData.growthPercentage < 0
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {result.growthData.growthPercentage > 0 ? '+' : ''}
                      {result.growthData.growthPercentage.toFixed(1)}%
                    </button>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {formatNumber(result.profile.followingCount)}
                  </div>
                  <div className="text-sm text-muted-foreground">Following</div>
                </div>
                
                {/* Platform-specific third metric */}
                {result.profile.platform === 'instagram' && 
                 result.profile.metrics && 
                 typeof result.profile.metrics.postCount === 'number' && (
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {formatNumber(result.profile.metrics.postCount)}
                    </div>
                    <div className="text-sm text-muted-foreground">Posts</div>
                  </div>
                )}
                
                {result.profile.platform === 'tiktok' && 
                 result.profile.metrics && 
                 typeof result.profile.metrics.likeCount === 'number' && (
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {formatNumber(result.profile.metrics.likeCount)}
                    </div>
                    <div className="text-sm text-muted-foreground">Likes</div>
                  </div>
                )}
              </div>
              
              {/* Profile Link at bottom */}
              <div className="pt-4 border-t border-border">
                <a
                  href={
                    result.profile.platform === 'tiktok' 
                      ? `https://www.tiktok.com/@${result.profile.username}`
                      : `https://www.${result.profile.platform}.com/${result.profile.username}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-medium text-sm"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Profile Link
                </a>
              </div>
            </CardContent>
          </Card>

                     {/* AI Analysis */}
           {result.profile.aiAnalysis && (
             <Card className="gabooja-card">
               <CardHeader>
                 <CardTitle className="flex items-center gap-2">
                   🤖 AI Analysis
                   <span className="text-sm font-normal text-muted-foreground">
                     Powered by OpenAI GPT-4 Vision
                   </span>
                 </CardTitle>
                 <CardDescription>
                   Comprehensive AI-powered insights about this creator
                 </CardDescription>
               </CardHeader>
               <CardContent>
                 <Tabs defaultValue="overview" className="w-full">
                   <TabsList className="grid w-full grid-cols-4">
                     <TabsTrigger value="overview">🏆 Overview</TabsTrigger>
                     <TabsTrigger value="metrics">📊 Metrics</TabsTrigger>
                     <TabsTrigger value="content">🎨 Content</TabsTrigger>
                     <TabsTrigger value="assessment">📝 Assessment</TabsTrigger>
                   </TabsList>
                   
                   <TabsContent value="overview" className="space-y-6">
                     <div className="grid md:grid-cols-2 gap-6 items-stretch">
                       {/* Creator Score */}
                      <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-[#241804] via-[#160e02] to-[#0c0902] border border-[#fcdd09]/30 shadow-[0_30px_60px_rgba(0,0,0,0.45)]">
                        <div className="text-sm font-semibold tracking-[0.2em] text-primary mb-3">Creator Score</div>
                         <div className="text-4xl font-bold text-primary mb-2">
                           {(() => {
                             const scoreText = result.profile.aiAnalysis.creator_score;
                             const scoreMatch = scoreText.match(/^(\d+(?:\.\d+)?(?:\/\d+)?)/);
                             return scoreMatch ? scoreMatch[1] : scoreText;
                           })()}
                         </div>
                         <div className="text-xs text-muted-foreground tracking-wide">Overall Rating</div>
                       </div>
                       
                       {/* Category */}
                      <div className="text-center p-6 rounded-2xl bg-card border border-border">
                        <div className="text-sm font-semibold tracking-[0.2em] text-muted-foreground mb-3">Category</div>
                         <CategoryEditor
                           currentCategory={currentCategory}
                           onCategoryChange={handleCategoryChange}
                           creatorUsername={result.profile.username}
                         />
                       </div>
                     </div>
                     
                     {/* Score Explanation */}
                     <div className="p-6 rounded-2xl bg-secondary border border-border">
                       <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                         <span>💡</span>
                         Analysis Summary
                       </h4>
                       <p className="text-base leading-relaxed text-muted-foreground">
                         {(() => {
                           const scoreText = result.profile.aiAnalysis.creator_score;
                           const explanationMatch = scoreText.match(/^(?:\d+(?:\.\d+)?(?:\/\d+)?\s*-?\s*)(.+)$/);
                           return explanationMatch ? explanationMatch[1].trim() : 'Detailed analysis of creator performance and potential.';
                         })()}
                       </p>
                     </div>
                   </TabsContent>
                   
                   <TabsContent value="metrics" className="space-y-6">
                     <div className="grid md:grid-cols-3 gap-6">
                       <div className="p-6 rounded-2xl bg-card border border-border">
                         <h4 className="font-semibold text-foreground flex items-center gap-2 mb-3 text-xl">
                           🎯 Brand Potential
                         </h4>
                         <p className="text-2xl font-bold text-primary mb-2">
                           {result.profile.aiAnalysis.brand_potential}
                         </p>
                         <p className="text-xs text-muted-foreground">
                           Potential for brand partnerships and collaborations
                         </p>
                       </div>
                       
                       <div className="p-6 rounded-2xl bg-card border border-border">
                         <h4 className="font-semibold text-foreground flex items-center gap-2 mb-3 text-xl">
                           💬 Engagement Quality
                         </h4>
                         <p className="text-2xl font-bold text-primary mb-2">
                           {result.profile.aiAnalysis.engagement_quality}
                         </p>
                         <p className="text-xs text-muted-foreground">
                           Quality and authenticity of audience interactions
                         </p>
                       </div>
                       
                       <div className="p-6 rounded-2xl bg-card border border-border">
                         <h4 className="font-semibold text-foreground flex items-center gap-2 mb-3 text-xl">
                           🤝 Collaboration Potential
                         </h4>
                         <p className="text-2xl font-bold text-primary mb-2">
                           {result.profile.aiAnalysis.collaboration_potential}
                         </p>
                         <p className="text-xs text-muted-foreground">
                           Likelihood of successful partnerships
                         </p>
                       </div>
                     </div>
                   </TabsContent>
                   
                   <TabsContent value="content" className="space-y-6">
                     <div className="grid md:grid-cols-2 gap-6">
                       <div className="p-6 rounded-2xl bg-card border border-border">
                         <h4 className="font-semibold text-foreground flex items-center gap-2 mb-4 text-lg">
                           🎭 Content Style
                         </h4>
                         <p className="text-base leading-relaxed">{result.profile.aiAnalysis.content_style}</p>
                       </div>
                       
                       <div className="p-6 rounded-2xl bg-card border border-border">
                         <h4 className="font-semibold text-foreground flex items-center gap-2 mb-4 text-lg">
                           💪 Key Strengths
                         </h4>
                         <p className="text-base leading-relaxed">{result.profile.aiAnalysis.key_strengths}</p>
                       </div>
                       
                       <div className="p-6 rounded-2xl bg-card border border-border md:col-span-2">
                         <h4 className="font-semibold text-foreground flex items-center gap-2 mb-4 text-lg">
                           👥 Audience Demographics
                         </h4>
                         <p className="text-base leading-relaxed">{result.profile.aiAnalysis.audience_demographics}</p>
                       </div>
                     </div>
                   </TabsContent>
                   
                   <TabsContent value="assessment" className="space-y-6">
                     <div className="p-8 rounded-2xl bg-secondary border border-border">
                       <h4 className="font-semibold text-foreground flex items-center gap-2 mb-6 text-xl">
                         📝 Overall Assessment
                       </h4>
                       <p className="text-lg leading-relaxed text-muted-foreground">{result.profile.aiAnalysis.overall_assessment}</p>
                     </div>
                   </TabsContent>
                 </Tabs>
               </CardContent>
             </Card>
           )}

                     {/* Screenshot - Collapsible */}
           {result.profile.profileImageBase64 && (
             <Card className="gabooja-card">
               <CardHeader 
                 className="cursor-pointer hover:bg-muted/50 transition-colors" 
                 onClick={() => setIsScreenshotOpen(!isScreenshotOpen)}
               >
                 <CardTitle className="flex items-center justify-between">
                   <span>Profile Screenshot</span>
                   {isScreenshotOpen ? (
                     <ChevronDown className="h-4 w-4" />
                   ) : (
                     <ChevronRight className="h-4 w-4" />
                   )}
                 </CardTitle>
                 <CardDescription>
                   Screenshot captured during analysis
                 </CardDescription>
               </CardHeader>
               {isScreenshotOpen && (
                 <CardContent>
                   <Image
                     src={`data:image/png;base64,${result.profile.profileImageBase64}`}
                     alt="Profile screenshot"
                     width={800}
                     height={600}
                     className="w-full rounded-lg border"
                   />
                 </CardContent>
               )}
             </Card>
           )}

           {/* Analysis Details - Collapsible */}
           <Card className="gabooja-card">
             <CardHeader 
               className="cursor-pointer hover:bg-muted/50 transition-colors" 
               onClick={() => setIsDetailsOpen(!isDetailsOpen)}
             >
               <CardTitle className="flex items-center justify-between">
                 <span>Analysis Details</span>
                 {isDetailsOpen ? (
                   <ChevronDown className="h-4 w-4" />
                 ) : (
                   <ChevronRight className="h-4 w-4" />
                 )}
               </CardTitle>
               <CardDescription>
                 Technical details about the analysis process
               </CardDescription>
             </CardHeader>
             {isDetailsOpen && (
               <CardContent>
                 <div className="space-y-6">
                   {/* Basic Analysis Info */}
                   <div className="grid md:grid-cols-2 gap-4 text-sm">
                     <div>
                       <strong>Method:</strong> {result.scrapingDetails.method}
                     </div>
                     <div>
                       <strong>Analyzed:</strong> {new Date(result.scrapingDetails.timestamp).toLocaleString()}
                     </div>
                   </div>

                   {/* AI Metrics */}
                   {hasAiMetrics(result) && (
                     <div className="p-4 rounded-2xl bg-secondary border border-border">
                       <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                         🤖 AI Analysis Metrics
                       </h4>
                       <div className="grid md:grid-cols-3 gap-4 text-sm">
                         <div>
                           <span className="text-muted-foreground">Model:</span>
                           <div className="font-medium">{result.aiMetrics.model}</div>
                         </div>
                         <div>
                           <span className="text-muted-foreground">Cost:</span>
                           <div className="font-medium">${result.aiMetrics.cost.toFixed(4)}</div>
                         </div>
                         <div>
                           <span className="text-muted-foreground">Cached:</span>
                           <div className="font-medium">{result.aiMetrics.cached ? 'Yes' : 'No'}</div>
                         </div>
                       </div>
                     </div>
                   )}

                   {/* Data Quality Metrics */}
                   {hasDataQuality(result) && (
                     <div className="p-4 rounded-2xl bg-secondary border border-border">
                       <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                         🔍 Data Quality Analysis
                       </h4>
                       
                       {/* Overall Score */}
                       <div className="mb-4">
                         <div className="flex items-center gap-3 mb-2">
                           <span className="text-sm text-muted-foreground">Overall Score:</span>
                           <div className="flex items-center gap-2">
                             <div className={`text-2xl font-bold ${
                               result.dataQuality.score >= 90 ? 'text-green-600' :
                               result.dataQuality.score >= 70 ? 'text-blue-600' :
                               result.dataQuality.score >= 50 ? 'text-yellow-600' : 'text-red-600'
                             }`}>
                               {result.dataQuality.score}
                             </div>
                             <div className="text-sm text-muted-foreground">/100</div>
                             <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                               result.dataQuality.isValid 
                                 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                 : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                             }`}>
                               {result.dataQuality.isValid ? 'Valid' : 'Needs Review'}
                             </div>
                           </div>
                         </div>
                         
                         {/* Quality Breakdown */}
                         <div className="grid md:grid-cols-3 gap-3 text-sm">
                  <div className="text-center p-3 rounded bg-card border border-border">
                             <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                               {result.dataQuality.breakdown.completeness}
                             </div>
                             <div className="text-xs text-muted-foreground">Completeness</div>
                           </div>
                  <div className="text-center p-3 rounded bg-card border border-border">
                             <div className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                               {result.dataQuality.breakdown.consistency}
                             </div>
                             <div className="text-xs text-muted-foreground">Consistency</div>
                           </div>
                  <div className="text-center p-3 rounded bg-card border border-border">
                             <div className="text-lg font-semibold text-orange-600 dark:text-orange-400">
                               {result.dataQuality.breakdown.reliability}
                             </div>
                             <div className="text-xs text-muted-foreground">Reliability</div>
                           </div>
                         </div>
                       </div>

                       {/* Transformations */}
                       {result.dataQuality.transformations > 0 && (
                         <div className="mb-3">
                           <span className="text-sm text-muted-foreground">Data Transformations:</span>
                           <div className="text-sm font-medium">{result.dataQuality.transformations} applied</div>
                         </div>
                       )}

                       {/* Issues */}
                       {result.dataQuality.issues.length > 0 && (
                         <div className="mb-3">
                           <span className="text-sm text-muted-foreground mb-2 block">Quality Issues:</span>
                           <div className="space-y-1">
                             {result.dataQuality.issues.slice(0, 3).map((issue, index) => (
                               <div key={index} className={`text-xs px-2 py-1 rounded ${
                                 issue.severity === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                                 issue.severity === 'warning' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                               }`}>
                                 {issue.field}: {issue.message}
                               </div>
                             ))}
                             {result.dataQuality.issues.length > 3 && (
                               <div className="text-xs text-muted-foreground">
                                 +{result.dataQuality.issues.length - 3} more issues
                               </div>
                             )}
                           </div>
                         </div>
                       )}

                       {/* Top Recommendations */}
                       {result.dataQuality.recommendations.length > 0 && (
                         <div>
                           <span className="text-sm text-muted-foreground mb-2 block">Top Recommendations:</span>
                           <div className="space-y-1">
                             {result.dataQuality.recommendations.slice(0, 2).map((rec, index) => (
                               <div key={index} className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 px-2 py-1 rounded">
                                 {rec}
                               </div>
                             ))}
                           </div>
                         </div>
                       )}
                     </div>
                   )}
                 </div>
               </CardContent>
             )}
           </Card>
      </div>
      )}

      {/* Comment Modal */}
      {result && (
        <BookmarkCommentModal
          isOpen={showCommentModal}
          onClose={() => setShowCommentModal(false)}
          onSave={handleSaveComments}
          creatorUsername={result.profile.username}
          platform={result.profile.platform}
          initialComments=""
          isEditing={false}
        />
      )}

      {/* Growth Chart Modal */}
      {result && (
        <GrowthChartModal
          creator={{
            username: result.profile.username,
            platform: result.profile.platform,
            displayName: result.profile.displayName
          }}
          isOpen={showGrowthChart}
          onClose={() => setShowGrowthChart(false)}
        />
      )}

      {/* Creator Matching Modal */}
      {result && (
        <CreatorMatchingModal
          creator={{
            username: result.profile.username,
            platform: result.profile.platform,
            displayName: result.profile.displayName
          }}
          isOpen={showCreatorMatching}
          onClose={() => setShowCreatorMatching(false)}
        />
      )}
    </div>
  );
} 