"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getBookmarkedCreators, removeBookmark, updateBookmarkComments } from '@/lib/bookmarks';
import { formatNumber } from '@/lib/utils';
import { Trash2, ExternalLink, Link, Eye, MessageSquare, Edit3 } from 'lucide-react';
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

  const handleViewAnalysis = (bookmark: UserBookmark) => {
    // Convert bookmark data to analysis format
    const analysisData: AnalysisData = {
      profile: {
        username: bookmark.username,
        platform: bookmark.platform as 'instagram' | 'tiktok' | 'youtube',
        displayName: bookmark.displayName,
        bio: bookmark.bio,
        profileImageUrl: bookmark.profileImageUrl || '',
        isVerified: bookmark.isVerified,
        followerCount: bookmark.followerCount,
        followingCount: bookmark.followingCount,
        website: bookmark.website,
        metrics: bookmark.metrics || {},
        aiAnalysis: bookmark.aiAnalysis,
      },
      scrapingDetails: {
        method: 'Bookmarked Creator',
        timestamp: bookmark.bookmarkedAt,
      },
    };
    
    setSelectedAnalysis(analysisData);
    setIsModalOpen(true);
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
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          bookmark.platform === 'instagram' 
                            ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
                            : bookmark.platform === 'tiktok'
                            ? 'bg-black text-white dark:bg-white dark:text-black'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}>
                          {bookmark.platform}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteClick(bookmark)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
                  {/* Horizontal Button Row */}
                  <div className="flex gap-2">
                    {/* View Analysis Button - only show if AI analysis exists */}
                    {bookmark.aiAnalysis && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewAnalysis(bookmark)}
                        className="flex-1 flex items-center gap-2"
                      >
                        <Eye className="h-3 w-3" />
                        View Analysis
                      </Button>
                    )}
                    
                    {/* Edit Notes Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditNotes(bookmark)}
                      className="flex-1 flex items-center gap-2"
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