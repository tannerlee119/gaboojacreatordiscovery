"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatNumber } from '@/lib/utils';
import { ChevronDown, ChevronRight, ExternalLink, Link, Bookmark, BookmarkCheck, RefreshCw } from 'lucide-react';
import { addBookmark, removeBookmark, isBookmarked, BookmarkedCreator } from '@/lib/bookmarks';
import { UserBookmarksService } from '@/lib/user-bookmarks';
import { useSupabaseAuth } from '@/lib/supabase-auth-context';
import { BookmarkCommentModal } from '@/components/ui/bookmark-comment-modal';
import { CategoryEditor } from '@/components/ui/category-editor';
import { CreatorCategory } from '@/lib/types';
import { GrowthChart } from '@/components/ui/growth-chart';
import Image from 'next/image';

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
  growthData?: {
    previousFollowerCount: number;
    growthPercentage: number;
  };
  lastAnalyzed?: string;
  cached?: boolean;
}

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysisData: AnalysisData;
  onRefresh?: (username: string, platform: string) => Promise<void>;
}

export function AnalysisModal({ isOpen, onClose, analysisData, onRefresh }: AnalysisModalProps) {
  const { user, session } = useSupabaseAuth();
  const isAuthenticated = !!session;
  const [isScreenshotOpen, setIsScreenshotOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [currentCategory, setCurrentCategory] = useState(analysisData.profile.aiAnalysis?.category || 'other');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showGrowthChart, setShowGrowthChart] = useState(false);
  
  const [bookmarkedStatus, setBookmarkedStatus] = useState<boolean>(false);

  // Check bookmark status based on user authentication
  const getBookmarkStatus = useCallback(async () => {
    if (isAuthenticated && user) {
      return await UserBookmarksService.isUserBookmarked(
        user.id, 
        analysisData.profile.username, 
        analysisData.profile.platform as 'instagram' | 'tiktok'
      );
    } else {
      return isBookmarked(analysisData.profile.platform, analysisData.profile.username);
    }
  }, [isAuthenticated, user, analysisData.profile.username, analysisData.profile.platform]);

  // Update bookmark status when analysis data or user changes
  useEffect(() => {
    const updateBookmarkStatus = async () => {
      const status = await getBookmarkStatus();
      setBookmarkedStatus(status);
    };
    updateBookmarkStatus();
  }, [getBookmarkStatus]);

  const handleBookmarkToggle = async () => {
    if (!user) return;

    if (bookmarkedStatus) {
      // Remove bookmark
      if (isAuthenticated) {
        await UserBookmarksService.removeUserBookmark(
          user.id, 
          analysisData.profile.username, 
          analysisData.profile.platform as 'instagram' | 'tiktok'
        );
      } else {
        removeBookmark(analysisData.profile.platform, analysisData.profile.username);
      }
      setBookmarkedStatus(false);
    } else {
      // Add bookmark (without comments initially)
      const bookmarkData: BookmarkedCreator = {
        id: Date.now().toString(),
        username: analysisData.profile.username,
        platform: analysisData.profile.platform,
        displayName: analysisData.profile.displayName,
        profileImageUrl: analysisData.profile.profileImageUrl,
        isVerified: analysisData.profile.isVerified,
        followerCount: analysisData.profile.followerCount,
        followingCount: analysisData.profile.followingCount,
        website: analysisData.profile.website,
        bio: analysisData.profile.bio,
        metrics: analysisData.profile.metrics,
        aiAnalysis: analysisData.profile.aiAnalysis,
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
    if (!user) return;
    
    try {
      if (isAuthenticated) {
        await UserBookmarksService.updateUserBookmarkComments(
          user.id,
          analysisData.profile.username,
          analysisData.profile.platform as 'instagram' | 'tiktok',
          comments
        );
      } else {
        // Update non-authenticated bookmark comments
        const bookmarks = JSON.parse(localStorage.getItem('gabooja_bookmarked_creators') || '[]');
        const bookmarkIndex = bookmarks.findIndex(
          (b: BookmarkedCreator) => b.platform === analysisData.profile.platform && b.username === analysisData.profile.username
        );
        
        if (bookmarkIndex >= 0) {
          bookmarks[bookmarkIndex].comments = comments;
          localStorage.setItem('gabooja_bookmarked_creators', JSON.stringify(bookmarks));
        }
      }
    } catch (error) {
      console.error('Error saving bookmark comments:', error);
    }
  };

  const handleCategoryChange = (newCategory: CreatorCategory) => {
    setCurrentCategory(newCategory);
    // You could add API call here to save the category change to database
    console.log(`Category changed from ${currentCategory} to ${newCategory} for @${analysisData.profile.username}`);
  };

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      await onRefresh(analysisData.profile.username, analysisData.profile.platform);
    } catch (error) {
      console.error('Error refreshing analysis:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                @{analysisData.profile.username}
                {analysisData.profile.isVerified && (
                  <span className="text-primary">✓</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  analysisData.profile.platform === 'instagram' 
                    ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
                    : analysisData.profile.platform === 'tiktok'
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                }`}>
                  {analysisData.profile.platform}
                </span>
              </div>
            </div>
          </DialogTitle>
          <DialogDescription>
            Creator Analysis Results
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Profile Overview */}
          <Card className="gabooja-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Profile Overview</span>
                <div className="flex items-center gap-2">
                  {onRefresh && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className="flex items-center gap-2 text-xs hover:bg-primary/10 hover:text-foreground hover:border-primary/30 transition-all duration-200"
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                      {isRefreshing ? 'Refreshing...' : 'Refresh'}
                    </Button>
                  )}
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
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysisData.profile.bio && (
                <div className="space-y-2">
                  <p className="text-sm leading-relaxed">{analysisData.profile.bio}</p>
                </div>
              )}
              
              {analysisData.profile.website && (
                <div className="space-y-2">
                  <a
                    href={analysisData.profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    <Link className="h-3 w-3" />
                    {analysisData.profile.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold gabooja-accent">
                    {formatNumber(analysisData.profile.followerCount)}
                  </div>
                  <div className="text-sm text-muted-foreground">Followers</div>
                  {analysisData.growthData && (
                    <button
                      onClick={() => setShowGrowthChart(true)}
                      className={`text-xs px-2 py-1 rounded-full mt-1 transition-colors hover:opacity-80 cursor-pointer ${
                        analysisData.growthData.growthPercentage > 0
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : analysisData.growthData.growthPercentage < 0
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'
                      }`}
                    >
                      {analysisData.growthData.growthPercentage > 0 ? '+' : ''}
                      {analysisData.growthData.growthPercentage.toFixed(1)}%
                    </button>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {formatNumber(analysisData.profile.followingCount)}
                  </div>
                  <div className="text-sm text-muted-foreground">Following</div>
                </div>
                
                {/* Platform-specific third metric */}
                {analysisData.profile.platform === 'instagram' && 
                 analysisData.profile.metrics && 
                 typeof analysisData.profile.metrics.postCount === 'number' && (
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {formatNumber(analysisData.profile.metrics.postCount)}
                    </div>
                    <div className="text-sm text-muted-foreground">Posts</div>
                  </div>
                )}
                
                {analysisData.profile.platform === 'tiktok' && 
                 analysisData.profile.metrics && 
                 typeof analysisData.profile.metrics.likeCount === 'number' && (
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {formatNumber(analysisData.profile.metrics.likeCount)}
                    </div>
                    <div className="text-sm text-muted-foreground">Likes</div>
                  </div>
                )}
              </div>
              
              {/* Profile Link at bottom */}
              <div className="pt-4 border-t border-border">
                <a
                  href={
                    analysisData.profile.platform === 'tiktok' 
                      ? `https://www.tiktok.com/@${analysisData.profile.username}`
                      : `https://www.${analysisData.profile.platform}.com/${analysisData.profile.username}`
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
          {analysisData.profile.aiAnalysis && (
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
                      <div className="text-center p-6 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
                        <div className="text-med font-medium gabooja-accent mb-2">Creator Score</div>
                        <div className="text-4xl font-bold gabooja-accent mb-2">
                          {(() => {
                            const scoreText = analysisData.profile.aiAnalysis.creator_score;
                            const scoreMatch = scoreText.match(/^(\d+(?:\.\d+)?(?:\/\d+)?)/);
                            return scoreMatch ? scoreMatch[1] : scoreText;
                          })()}
                        </div>
                        <div className="text-xs text-muted-foreground">Overall Rating</div>
                      </div>
                      
                      {/* Category */}
                      <div className="text-center p-6 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800">
                        <div className="text-med font-medium gabooja-accent mb-2">Category</div>
                        <CategoryEditor
                          currentCategory={currentCategory}
                          onCategoryChange={handleCategoryChange}
                          creatorUsername={analysisData.profile.username}
                        />
                      </div>
                    </div>
                    
                    {/* Score Explanation */}
                    <div className="p-6 rounded-lg bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/30 border border-slate-200 dark:border-slate-700">
                      <h4 className="font-semibold gabooja-accent mb-3 flex items-center gap-2">
                        <span>💡</span>
                        Analysis Summary
                      </h4>
                      <p className="text-base leading-relaxed text-muted-foreground">
                        {(() => {
                          const scoreText = analysisData.profile.aiAnalysis.creator_score;
                          const explanationMatch = scoreText.match(/^(?:\d+(?:\.\d+)?(?:\/\d+)?\s*-?\s*)(.+)$/);
                          return explanationMatch ? explanationMatch[1].trim() : 'Detailed analysis of creator performance and potential.';
                        })()}
                      </p>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="metrics" className="space-y-6">
                    {/* Platform-specific Metrics */}
                    <div className="grid gap-4 mb-6">
                      {analysisData.profile.platform === 'instagram' && 
                       analysisData.profile.metrics && 
                       typeof analysisData.profile.metrics.postCount === 'number' && (
                        <div className="p-4 rounded-lg bg-gradient-to-r from-pink-50 to-pink-100 dark:from-pink-950/20 dark:to-pink-900/20 border border-pink-200 dark:border-pink-800 text-center">
                          <div className="text-lg font-bold text-pink-700 dark:text-pink-300">
                            {formatNumber(analysisData.profile.metrics.postCount)}
                          </div>
                          <div className="text-xs text-pink-600 dark:text-pink-400">Posts</div>
                        </div>
                      )}
                      {analysisData.profile.platform === 'tiktok' && 
                       analysisData.profile.metrics && 
                       typeof analysisData.profile.metrics.likeCount === 'number' && (
                        <div className="p-4 rounded-lg bg-gradient-to-r from-black/5 to-black/10 dark:from-white/5 dark:to-white/10 border border-black/20 dark:border-white/20 text-center">
                          <div className="text-lg font-bold">
                            {formatNumber(analysisData.profile.metrics.likeCount)}
                          </div>
                          <div className="text-xs text-muted-foreground">Total Likes</div>
                        </div>
                      )}
                      {analysisData.profile.platform === 'tiktok' && 
                       analysisData.profile.metrics && 
                       typeof analysisData.profile.metrics.videoCount === 'number' && (
                        <div className="p-4 rounded-lg bg-gradient-to-r from-black/5 to-black/10 dark:from-white/5 dark:to-white/10 border border-black/20 dark:border-white/20 text-center">
                          <div className="text-lg font-bold">
                            {formatNumber(analysisData.profile.metrics.videoCount)}
                          </div>
                          <div className="text-xs text-muted-foreground">Videos</div>
                        </div>
                      )}
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                      <div className="p-6 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800">
                        <h4 className="font-semibold gabooja-accent flex items-center gap-2 mb-3 text-2xl">
                          🎯 Brand Potential
                        </h4>
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mb-2">
                          {analysisData.profile.aiAnalysis.brand_potential}
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          Potential for brand partnerships and collaborations
                        </p>
                      </div>
                      
                      <div className="p-6 rounded-lg bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20 border border-green-200 dark:border-green-800">
                        <h4 className="font-semibold gabooja-accent flex items-center gap-2 mb-3 text-2xl">
                          💬 Engagement Quality
                        </h4>
                        <p className="text-2xl font-bold text-green-700 dark:text-green-300 mb-2">
                          {analysisData.profile.aiAnalysis.engagement_quality}
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400">
                          Quality and authenticity of audience interactions
                        </p>
                      </div>
                      
                      <div className="p-6 rounded-lg bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 border border-purple-200 dark:border-purple-800">
                        <h4 className="font-semibold gabooja-accent flex items-center gap-2 mb-3 text-2xl">
                          🤝 Collaboration Potential
                        </h4>
                        <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mb-2">
                          {analysisData.profile.aiAnalysis.collaboration_potential}
                        </p>
                        <p className="text-xs text-purple-600 dark:text-purple-400">
                          Likelihood of successful partnerships
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="content" className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="p-6 rounded-lg bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/20 dark:to-pink-950/20 border border-rose-200 dark:border-rose-800">
                        <h4 className="font-semibold gabooja-accent flex items-center gap-2 mb-4 text-lg">
                          🎭 Content Style
                        </h4>
                        <p className="text-base leading-relaxed">{analysisData.profile.aiAnalysis.content_style}</p>
                      </div>
                      
                      <div className="p-6 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800">
                        <h4 className="font-semibold gabooja-accent flex items-center gap-2 mb-4 text-lg">
                          💪 Key Strengths
                        </h4>
                        <p className="text-base leading-relaxed">{analysisData.profile.aiAnalysis.key_strengths}</p>
                      </div>
                      
                      <div className="p-6 rounded-lg bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 border border-indigo-200 dark:border-indigo-800 md:col-span-2">
                        <h4 className="font-semibold gabooja-accent flex items-center gap-2 mb-4 text-lg">
                          👥 Audience Demographics
                        </h4>
                        <p className="text-base leading-relaxed">{analysisData.profile.aiAnalysis.audience_demographics}</p>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="assessment" className="space-y-6">
                    <div className="p-8 rounded-lg bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/30 border border-slate-200 dark:border-slate-700">
                      <h4 className="font-semibold gabooja-accent flex items-center gap-2 mb-6 text-xl">
                        📝 Overall Assessment
                      </h4>
                      <p className="text-lg leading-relaxed">{analysisData.profile.aiAnalysis.overall_assessment}</p>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {/* Screenshot - Collapsible */}
          {analysisData.profile.profileImageBase64 && (
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
                    src={`data:image/png;base64,${analysisData.profile.profileImageBase64}`}
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
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Method:</strong> {analysisData.scrapingDetails.method}
                  </div>
                  <div>
                    <strong>Analyzed:</strong> {new Date(analysisData.scrapingDetails.timestamp).toLocaleString()}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </DialogContent>
      
      {/* Comment Modal */}
      <BookmarkCommentModal
        isOpen={showCommentModal}
        onClose={() => setShowCommentModal(false)}
        onSave={handleSaveComments}
        creatorUsername={analysisData.profile.username}
        platform={analysisData.profile.platform}
        initialComments=""
        isEditing={false}
      />

      {/* Growth Chart Modal */}
      {analysisData.growthData && (
        <GrowthChart
          isOpen={showGrowthChart}
          onClose={() => setShowGrowthChart(false)}
          growthData={{
            previousFollowerCount: analysisData.growthData.previousFollowerCount,
            growthPercentage: analysisData.growthData.growthPercentage,
            currentFollowerCount: analysisData.profile.followerCount,
            lastAnalyzed: analysisData.lastAnalyzed || analysisData.scrapingDetails.timestamp,
            previousAnalyzed: undefined // We could add this if we store more historical data
          }}
          username={analysisData.profile.username}
          platform={analysisData.profile.platform}
        />
      )}
    </Dialog>
  );
} 