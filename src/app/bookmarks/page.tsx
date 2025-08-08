"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getBookmarkedCreators, removeBookmark, updateBookmarkComments } from '@/lib/bookmarks';
import { formatNumber } from '@/lib/utils';
import { Trash2, ExternalLink, Link, Eye, MessageSquare, Edit3, RefreshCw } from 'lucide-react';
import { AnalysisModal } from '@/components/ui/analysis-modal';
import { BookmarkCommentModal } from '@/components/ui/bookmark-comment-modal';
import { DeleteConfirmationModal } from '@/components/ui/delete-confirmation-modal';
import { useSupabaseAuth } from '@/lib/supabase-auth-context';
import { UserBookmarksService, UserBookmark } from '@/lib/user-bookmarks';

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
  const [refreshingBookmarks, setRefreshingBookmarks] = useState<Set<string>>(new Set());

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
    return colors[category] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  };

  // Load bookmarks on component mount
  useEffect(() => {
    const loadBookmarks = async () => {
      if (isAuthenticated && user) {
        const userBookmarks = await UserBookmarksService.getUserBookmarks(user.id);
        setBookmarks(userBookmarks);
      } else {
        // Fallback to global bookmarks for non-authenticated users
        const savedBookmarks = getBookmarkedCreators();
        setBookmarks(savedBookmarks.map(bookmark => ({
          ...bookmark,
          userId: 'anonymous',
          bookmarkedAt: bookmark.bookmarkedAt || new Date().toISOString()
        })));
      }
      setLoading(false);
    };

    loadBookmarks();
    
    // Listen for storage changes to sync across tabs
    const handleStorageChange = () => {
      loadBookmarks();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isAuthenticated, user]);

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

  const handleRefreshBookmark = async (bookmark: UserBookmark) => {
    const bookmarkKey = `${bookmark.username}_${bookmark.platform}`;
    setRefreshingBookmarks(prev => new Set([...prev, bookmarkKey]));

    try {
      // Fetch latest data from discovery API
      const response = await fetch(`/api/discover-creators?platform=${bookmark.platform}&search=${bookmark.username}&limit=1`);
      const data = await response.json();
      
      if (data.creators && data.creators.length > 0) {
        const updatedCreator = data.creators[0];
        
        // Update the bookmark with latest data
        const updatedBookmark: UserBookmark = {
          ...bookmark,
          displayName: updatedCreator.displayName || bookmark.displayName,
          followerCount: updatedCreator.followerCount || bookmark.followerCount,
          followingCount: updatedCreator.followingCount || bookmark.followingCount,
          bio: updatedCreator.bio || bookmark.bio,
          website: updatedCreator.website || bookmark.website,
          metrics: updatedCreator.engagementRate ? {
            ...bookmark.metrics,
            engagementRate: updatedCreator.engagementRate
          } : bookmark.metrics,
          aiAnalysis: {
            creator_score: updatedCreator.aiScore || bookmark.aiAnalysis?.creator_score || '0',
            category: updatedCreator.category || bookmark.aiAnalysis?.category || 'other',
            brand_potential: updatedCreator.brandPotential || bookmark.aiAnalysis?.brand_potential || '',
            key_strengths: updatedCreator.keyStrengths || bookmark.aiAnalysis?.key_strengths || '',
            engagement_quality: updatedCreator.engagementQuality || bookmark.aiAnalysis?.engagement_quality || '',
            content_style: updatedCreator.contentStyle || bookmark.aiAnalysis?.content_style || '',
            audience_demographics: updatedCreator.audienceDemographics || bookmark.aiAnalysis?.audience_demographics || '',
            collaboration_potential: updatedCreator.collaborationPotential || bookmark.aiAnalysis?.collaboration_potential || '',
            overall_assessment: updatedCreator.overallAssessment || bookmark.aiAnalysis?.overall_assessment || '',
          }
        };

        // Update local state
        setBookmarks(prev => prev.map(b => 
          b.username === bookmark.username && b.platform === bookmark.platform 
            ? updatedBookmark 
            : b
        ));

        // Update storage
        if (isAuthenticated && user) {
          await UserBookmarksService.updateUserBookmark(user.id, updatedBookmark);
        } else {
          // Update localStorage for non-authenticated users
          const storedBookmarks = getBookmarkedCreators();
          const updatedStoredBookmarks = storedBookmarks.map(b =>
            b.username === bookmark.username && b.platform === bookmark.platform
              ? updatedBookmark
              : b
          );
          localStorage.setItem('gabooja_bookmarked_creators', JSON.stringify(updatedStoredBookmarks));
        }
        
        console.log('✅ Bookmark data refreshed successfully');
      } else {
        console.warn('⚠️ No updated data found for this creator');
      }
    } catch (error) {
      console.error('❌ Error refreshing bookmark data:', error);
    } finally {
      setRefreshingBookmarks(prev => {
        const newSet = new Set(prev);
        newSet.delete(bookmarkKey);
        return newSet;
      });
    }
  };

  const handleViewAnalysis = async (bookmark: UserBookmark) => {
    // Convert bookmark data to complete analysis format - ensure ALL fields are populated
    let analysisData: AnalysisData = {
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
      lastAnalyzed: bookmark.bookmarkedAt,
      cached: true, // Bookmark data is considered cached
    };

    // If AI fields are incomplete, enrich with cached full analysis from API (no forced refresh)
    const needsEnrichment = !bookmark.aiAnalysis || (
      !bookmark.aiAnalysis.brand_potential ||
      !bookmark.aiAnalysis.key_strengths ||
      !bookmark.aiAnalysis.engagement_quality ||
      !bookmark.aiAnalysis.content_style ||
      !bookmark.aiAnalysis.audience_demographics ||
      !bookmark.aiAnalysis.collaboration_potential ||
      !bookmark.aiAnalysis.overall_assessment
    );

    if (needsEnrichment) {
      try {
        const response = await fetch('/api/analyze-creator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: bookmark.username,
            platform: bookmark.platform,
            forceRefresh: false
          })
        });
        const data = await response.json();
        if (data?.success && data.data) {
          analysisData = {
            ...data.data,
            cached: true
          } as AnalysisData;
        }
      } catch (error) {
        console.error('Error enriching analysis from API:', error);
      }
    }

    setSelectedAnalysis(analysisData);
    setIsModalOpen(true);
  };

  const handleRefreshFromModal = async (username: string, platform: string) => {
    // Trigger a fresh analysis for the creator (same behavior as discovery modal)
    const response = await fetch('/api/analyze-creator', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        username, 
        platform,
        forceRefresh: true 
      }),
    });

    const data = await response.json();
    if (data.success) {
      setSelectedAnalysis(data.data);
    } else {
      throw new Error(data.error || 'Failed to refresh analysis');
    }
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bookmarks.map((bookmark) => (
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
                            ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
                            : bookmark.platform === 'tiktok'
                            ? 'bg-black text-white dark:bg-white dark:text-black'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
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
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">
                      {formatNumber(bookmark.followingCount)}
                    </div>
                    <div className="text-xs text-muted-foreground">Following</div>
                  </div>
                </div>

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
    </div>
  );
} 