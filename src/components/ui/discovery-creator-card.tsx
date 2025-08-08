"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatNumber } from '@/lib/utils';
import { Bookmark, BookmarkCheck, BarChart3, ExternalLink, Eye } from 'lucide-react';

export interface DiscoveryCreator {
  id: string;
  username: string;
  platform: 'instagram' | 'tiktok';
  displayName: string;
  overallAssessment?: string; // Replace bio with AI assessment
  isVerified: boolean;
  followerCount: number;
  followingCount: number;
  category: string;
  aiScore?: string; // Replace engagementRate with AI score
  location?: string;
  website?: string;
  bio?: string;
  profileImageUrl?: string;
  engagementRate?: number;
  // AI analysis fields
  brandPotential?: string;
  keyStrengths?: string;
  engagementQuality?: string;
  contentStyle?: string;
  audienceDemographics?: string;
  collaborationPotential?: string;
  lastAnalysisDate?: string;
}

interface DiscoveryCreatorCardProps {
  creator: DiscoveryCreator;
  isBookmarked: boolean;
  onBookmark: (creator: DiscoveryCreator) => void;
  onAnalyze: (creator: DiscoveryCreator) => void;
  onViewAnalysis?: (creator: DiscoveryCreator) => void;
}

export function DiscoveryCreatorCard({ 
  creator, 
  isBookmarked, 
  onBookmark, 
  onAnalyze,
  onViewAnalysis
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

  const handleViewProfile = () => {
    const profileUrl = creator.platform === 'instagram' 
      ? `https://instagram.com/${creator.username}`
      : `https://tiktok.com/@${creator.username}`;
    
    window.open(profileUrl, '_blank', 'noopener,noreferrer');
  };

  const handleViewAnalysis = () => {
    if (onViewAnalysis) {
      onViewAnalysis(creator);
    }
  };

  // Check if creator has analysis data (any of the key AI fields)
  const hasAnalysisData = creator.brandPotential || creator.keyStrengths || creator.engagementQuality || creator.overallAssessment;

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

  const getAiScoreColor = (score: string) => {
    const numScore = parseFloat(score);
    if (numScore >= 8) return 'text-green-600 dark:text-green-400';
    if (numScore >= 6) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <Card className="gabooja-card hover:shadow-lg transition-shadow duration-200">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header with bookmark */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-base font-semibold truncate">
                  @{creator.username}
                </span>
                {creator.isVerified && (
                  <span className="text-primary text-sm">✓</span>
                )}
              </div>
            </div>
            <Button
              variant={isBookmarked ? "default" : "outline"}
              size="sm"
              onClick={handleBookmark}
              disabled={isBookmarkLoading}
              className="group h-8 w-8 p-0 flex-shrink-0 ml-2 cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-all duration-200"
            >
              {isBookmarked ? (
                <BookmarkCheck className="h-4 w-4 text-white dark:text-black group-hover:!text-black dark:group-hover:!text-white" />
              ) : (
                <Bookmark className="h-4 w-4 text-black dark:text-white group-hover:!text-black dark:group-hover:!text-white" />
              )}
            </Button>
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

          {/* Overall Assessment */}
          {creator.overallAssessment && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {creator.overallAssessment}
            </p>
          )}

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-3 py-2 text-xs">
            <div>
              <p className="text-muted-foreground">Followers</p>
              <p className="font-medium">{formatNumber(creator.followerCount)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">AI Score</p>
              <p className={`font-medium ${creator.aiScore ? getAiScoreColor(creator.aiScore) : 'text-muted-foreground'}`}>
                {creator.aiScore || 'N/A'}
              </p>
            </div>
          </div>


          {/* Action buttons */}
          <div className={`grid gap-2 pt-2 ${hasAnalysisData ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {hasAnalysisData && onViewAnalysis && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleViewAnalysis}
                className="text-xs cursor-pointer hover:bg-primary/10 hover:text-foreground hover:border-primary/30 transition-all duration-200"
              >
                <Eye className="h-3 w-3 mr-1" />
                View Analysis
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleAnalyze}
              disabled={isAnalyzeLoading}
              className="text-xs cursor-pointer hover:bg-primary/10 hover:text-foreground hover:border-primary/30 transition-all duration-200"
            >
              <BarChart3 className="h-3 w-3 mr-1" />
              {isAnalyzeLoading ? 'Analyzing...' : 'Analyze'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewProfile}
              className="text-xs cursor-pointer hover:bg-primary/10 hover:text-foreground hover:border-primary/30 transition-all duration-200"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View Profile
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}