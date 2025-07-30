"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatNumber } from '@/lib/utils';
import { Bookmark, BookmarkCheck, Eye, BarChart3 } from 'lucide-react';

export interface DiscoveryCreator {
  id: string;
  username: string;
  platform: 'instagram' | 'tiktok';
  displayName: string;
  bio?: string;
  isVerified: boolean;
  followerCount: number;
  followingCount: number;
  category: string;
  engagementRate: number;
  location?: string;
}

interface DiscoveryCreatorCardProps {
  creator: DiscoveryCreator;
  isBookmarked: boolean;
  onBookmark: (creator: DiscoveryCreator) => void;
  onAnalyze: (creator: DiscoveryCreator) => void;
  onViewProfile?: (creator: DiscoveryCreator) => void;
}

export function DiscoveryCreatorCard({ 
  creator, 
  isBookmarked, 
  onBookmark, 
  onAnalyze, 
  onViewProfile 
}: DiscoveryCreatorCardProps) {
  const [isBookmarkLoading, setIsBookmarkLoading] = useState(false);
  const [isAnalyzeLoading, setIsAnalyzeLoading] = useState(false);

  const handleBookmark = async () => {
    setIsBookmarkLoading(true);
    try {
      await onBookmark(creator);
    } finally {
      setIsBookmarkLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzeLoading(true);
    try {
      await onAnalyze(creator);
    } finally {
      setIsAnalyzeLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      fitness: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      food: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      tech: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      beauty: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
      travel: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      comedy: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      fashion: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
      gaming: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      music: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
      education: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      business: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300',
      art: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
      pets: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      family: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
      lifestyle: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
    };
    return colors[category] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  };

  const getEngagementColor = (rate: number) => {
    if (rate >= 6) return 'text-green-600 dark:text-green-400';
    if (rate >= 3) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <Card className="gabooja-card hover:shadow-lg transition-shadow duration-200">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header with username and verification */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold">
                @{creator.username}
              </span>
              {creator.isVerified && (
                <span className="text-primary">✓</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBookmark}
              disabled={isBookmarkLoading}
              className="h-8 w-8 p-0"
            >
              {isBookmarked ? (
                <BookmarkCheck className="h-4 w-4 text-primary" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Display name */}
          <div className="text-sm text-muted-foreground">
            {creator.displayName}
          </div>

          {/* Platform and category tags */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              creator.platform === 'instagram' 
                ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
                : 'bg-black text-white dark:bg-white dark:text-black'
            }`}>
              {creator.platform}
            </span>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(creator.category)}`}>
              {creator.category}
            </span>
          </div>

          {/* Bio */}
          {creator.bio && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {creator.bio}
            </p>
          )}

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-3 py-2 text-xs">
            <div>
              <p className="text-muted-foreground">Followers</p>
              <p className="font-medium">{formatNumber(creator.followerCount)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Engagement</p>
              <p className={`font-medium ${getEngagementColor(creator.engagementRate)}`}>
                {creator.engagementRate.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Location */}
          {creator.location && (
            <p className="text-xs text-muted-foreground">
              📍 {creator.location}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAnalyze}
              disabled={isAnalyzeLoading}
              className="flex-1 text-xs"
            >
              <BarChart3 className="h-3 w-3 mr-1" />
              {isAnalyzeLoading ? 'Analyzing...' : 'Analyze'}
            </Button>
            {onViewProfile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewProfile(creator)}
                className="flex-1 text-xs"
              >
                <Eye className="h-3 w-3 mr-1" />
                View
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}