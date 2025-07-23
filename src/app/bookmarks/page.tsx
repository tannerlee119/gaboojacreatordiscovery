"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookmarkedCreator, getBookmarkedCreators, removeBookmark } from '@/lib/bookmarks';
import { formatNumber } from '@/lib/utils';
import { Trash2, ExternalLink, Link } from 'lucide-react';
import Image from 'next/image';

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkedCreator[]>([]);
  const [loading, setLoading] = useState(true);

  // Load bookmarks on component mount
  useEffect(() => {
    const loadBookmarks = () => {
      const savedBookmarks = getBookmarkedCreators();
      setBookmarks(savedBookmarks);
      setLoading(false);
    };

    loadBookmarks();
    
    // Listen for storage changes to sync across tabs
    const handleStorageChange = () => {
      loadBookmarks();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleRemoveBookmark = (platform: string, username: string) => {
    removeBookmark(platform as 'instagram' | 'tiktok', username);
    // Update local state
    setBookmarks(prev => prev.filter(b => !(b.platform === platform && b.username === username)));
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
                    {bookmark.profileImageUrl && (
                      <Image
                        src={bookmark.profileImageUrl}
                        alt={`${bookmark.displayName} profile`}
                        width={50}
                        height={50}
                        className="rounded-full"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold">{bookmark.displayName}</span>
                        {bookmark.isVerified && (
                          <span className="text-primary">✓</span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        @{bookmark.username} on {bookmark.platform}
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveBookmark(bookmark.platform, bookmark.username)}
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
                {/* Bio for TikTok */}
                {bookmark.bio && bookmark.platform === 'tiktok' && (
                  <p className="text-sm leading-relaxed">{bookmark.bio}</p>
                )}
                
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
                
                {/* Profile Link */}
                <div className="pt-2 border-t border-border">
                  <a
                    href={
                      bookmark.platform === 'tiktok' 
                        ? `https://www.tiktok.com/@${bookmark.username}`
                        : `https://www.${bookmark.platform}.com/${bookmark.username}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-medium text-sm"
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
    </div>
  );
} 