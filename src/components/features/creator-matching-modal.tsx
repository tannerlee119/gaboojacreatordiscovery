'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, ExternalLink, CheckCircle, AlertCircle, Search } from 'lucide-react';

interface CreatorMatch {
  username: string;
  platform: 'instagram' | 'tiktok';
  displayName: string;
  profileImageUrl?: string;
  confidence: number;
  matchingFactors: Array<{
    signal: string;
    confidence: number;
    details: string;
  }>;
}

interface CreatorMatchingData {
  targetCreator: {
    username: string;
    platform: 'instagram' | 'tiktok';
    displayName: string;
    followerCount: number;
  };
  totalConfidence: number;
  matchingSignals: string[];
  potentialMatches: CreatorMatch[];
  suggestedMatch?: CreatorMatch;
}

interface CreatorMatchingModalProps {
  creator: {
    username: string;
    platform: 'instagram' | 'tiktok';
    displayName?: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

export function CreatorMatchingModal({ creator, isOpen, onClose }: CreatorMatchingModalProps) {
  const [matchingData, setMatchingData] = useState<CreatorMatchingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMatchingData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/creator-matches?username=${encodeURIComponent(creator.username)}&platform=${creator.platform}`
      );
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch matching data');
      }
      
      setMatchingData(result.data);
    } catch (err) {
      console.error('Error fetching matching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load matching data');
    } finally {
      setLoading(false);
    }
  }, [creator.username, creator.platform]);

  useEffect(() => {
    if (isOpen && creator.username && creator.platform) {
      fetchMatchingData();
    }
  }, [isOpen, creator.username, creator.platform, fetchMatchingData]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 75) return 'bg-green-100 text-green-800 border-green-200';
    if (confidence >= 50) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (confidence >= 25) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 75) return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (confidence >= 50) return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    return <AlertCircle className="h-4 w-4 text-orange-600" />;
  };

  const getPlatformColor = (platform: string) => {
    return platform === 'instagram' 
      ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
      : 'bg-secondary text-foreground';
  };

  const getProfileUrl = (username: string, platform: string) => {
    return platform === 'tiktok' 
      ? `https://www.tiktok.com/@${username}`
      : `https://www.${platform}.com/${username}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto [&>button]:focus:outline-none [&>button]:focus:ring-0 [&>button]:focus:bg-transparent [&>button]:data-[state=open]:bg-transparent">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-xl font-bold">
            Cross-Platform Creator Matching
          </DialogTitle>
          
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <span className="font-medium">
              Finding matches for {creator.displayName || creator.username}
            </span>
            <span>•</span>
            <span className="capitalize">{creator.platform}</span>
            <span>•</span>
            <span>@{creator.username}</span>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-muted-foreground">Analyzing potential matches...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Unable to find matches
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    {error}
                  </div>
                </div>
              </div>
            </div>
          )}

          {matchingData && (
            <>
              {/* Suggested Match (High Confidence) */}
              {matchingData.suggestedMatch && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                    <h3 className="text-lg font-semibold text-green-800">
                      Highly Likely Match Found!
                    </h3>
                    <Badge className="bg-green-100 text-green-800 border-green-200">
                      {matchingData.suggestedMatch.confidence}% confidence
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="font-medium text-green-900">
                          {matchingData.suggestedMatch.displayName}
                        </div>
                        <div className="text-sm text-green-700">
                          @{matchingData.suggestedMatch.username}
                        </div>
                        <Badge className={`mt-1 ${getPlatformColor(matchingData.suggestedMatch.platform)}`}>
                          {matchingData.suggestedMatch.platform}
                        </Badge>
                      </div>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="text-green-700 border-green-300 hover:bg-green-50"
                    >
                      <a
                        href={getProfileUrl(matchingData.suggestedMatch.username, matchingData.suggestedMatch.platform)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View Profile
                      </a>
                    </Button>
                  </div>

                  <div className="mt-4">
                    <div className="text-sm font-medium text-green-800 mb-2">
                      Matching Signals:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {matchingData.suggestedMatch.matchingFactors.map((factor, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="text-xs bg-green-100 text-green-700"
                          title={factor.details}
                        >
                          {factor.signal} ({factor.confidence}%)
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* All Potential Matches */}
            <div className="bg-card rounded-lg border border-border">
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">
                      All Potential Matches
                    </h3>
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {matchingData.potentialMatches.length} matches found
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ranked by matching confidence across multiple signals
                  </p>
                </div>

                {matchingData.potentialMatches.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No potential matches found</p>
                    <p className="text-sm mt-1">
                      This creator may not have a cross-platform presence, or they use different branding.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {matchingData.potentialMatches.map((match, _index) => (
                      <div key={`${match.platform}-${match.username}`} className="p-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              {getConfidenceIcon(match.confidence)}
                              <Badge className={getConfidenceColor(match.confidence)}>
                                {match.confidence}% match
                              </Badge>
                            </div>
                            
                            <div>
                              <div className="font-medium text-foreground">
                                {match.displayName}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                @{match.username}
                              </div>
                              <Badge className={`mt-1 text-xs ${getPlatformColor(match.platform)}`}>
                                {match.platform}
                              </Badge>
                            </div>
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a
                              href={getProfileUrl(match.username, match.platform)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2"
                            >
                              <ExternalLink className="h-4 w-4" />
                              View Profile
                            </a>
                          </Button>
                        </div>

                        {match.matchingFactors.length > 0 && (
                          <div className="mt-3">
                            <div className="text-xs font-medium text-muted-foreground mb-2">
                              Why this might be the same person:
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {match.matchingFactors.slice(0, 4).map((factor, factorIndex) => (
                                <Badge
                                  key={factorIndex}
                                  variant="secondary"
                                  className="text-xs"
                                  title={factor.details}
                                >
                                  {factor.signal}
                                </Badge>
                              ))}
                              {match.matchingFactors.length > 4 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{match.matchingFactors.length - 4} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* How It Works */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-800 mb-2">
                  How Cross-Platform Matching Works
                </h4>
                <div className="text-xs text-blue-700 space-y-1">
                  <div>• <strong>High confidence signals:</strong> Display name match, bio similarity, shared website links</div>
                  <div>• <strong>Medium confidence signals:</strong> Username similarity, location match, content style</div>
                  <div>• <strong>Supporting signals:</strong> Similar follower counts, category match, engagement patterns</div>
                  <div>• <strong>Verification:</strong> Always manually verify matches by visiting the suggested profiles</div>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}