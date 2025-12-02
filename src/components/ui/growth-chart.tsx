"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatNumber } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface GrowthData {
  previousFollowerCount: number;
  growthPercentage: number;
  currentFollowerCount: number;
  lastAnalyzed: string;
  previousAnalyzed?: string;
}

interface GrowthChartProps {
  isOpen: boolean;
  onClose: () => void;
  growthData: GrowthData;
  username: string;
  platform: string;
}

export function GrowthChart({ isOpen, onClose, growthData, username, platform }: GrowthChartProps) {
  const { previousFollowerCount, growthPercentage, currentFollowerCount, lastAnalyzed, previousAnalyzed } = growthData;
  
  const isGrowth = growthPercentage > 0;
  const isDecline = growthPercentage < 0;
  const isNoChange = growthPercentage === 0;
  
  const followerChange = currentFollowerCount - previousFollowerCount;
  
  const getTrendIcon = () => {
    if (isGrowth) return <TrendingUp className="h-4 w-4 text-green-400" />;
    if (isDecline) return <TrendingDown className="h-4 w-4 text-red-400" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getTrendColor = () => {
    if (isGrowth) return 'text-green-400 bg-green-200/10 border-green-500/30';
    if (isDecline) return 'text-red-400 bg-red-200/10 border-red-500/30';
    return 'text-muted-foreground bg-muted border-border';
  };

  const getChangeText = () => {
    if (isGrowth) return `+${Math.abs(followerChange).toLocaleString()} followers`;
    if (isDecline) return `-${Math.abs(followerChange).toLocaleString()} followers`;
    return 'No change in followers';
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getTrendIcon()}
            Growth Trend for @{username}
          </DialogTitle>
          <DialogDescription>
            Follower growth analysis between your last two analyses
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Main Growth Card */}
          <Card className={`border-2 ${getTrendColor()}`}>
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-3xl font-bold">
                {growthPercentage > 0 ? '+' : ''}{growthPercentage.toFixed(2)}%
              </CardTitle>
              <CardDescription>
                {getChangeText()}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Comparison Data */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Previous Analysis</CardTitle>
                <CardDescription>
                  {previousAnalyzed ? 
                    new Date(previousAnalyzed).toLocaleDateString() : 
                    'Earlier analysis'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-muted-foreground">
                  {formatNumber(previousFollowerCount)}
                </div>
                <div className="text-sm text-muted-foreground">followers</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Current Analysis</CardTitle>
                <CardDescription>
                  {new Date(lastAnalyzed).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${isGrowth ? 'text-green-400' : isDecline ? 'text-red-400' : 'text-muted-foreground'}`}>
                  {formatNumber(currentFollowerCount)}
                </div>
                <div className="text-sm text-muted-foreground">followers</div>
              </CardContent>
            </Card>
          </div>

          {/* Visual Progress Bar */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Growth Visualization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Progress bar */}
                <div className="relative">
                  <div className="w-full bg-muted rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full transition-all duration-500 ${
                        isGrowth ? 'bg-green-400' : 
                        isDecline ? 'bg-red-400' : 
                        'bg-muted-foreground'
                      }`}
                      style={{
                        width: `${Math.min(Math.abs(growthPercentage) * 2, 100)}%`
                      }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground mt-2">
                    <span>Previous: {formatNumber(previousFollowerCount)}</span>
                    <span>Current: {formatNumber(currentFollowerCount)}</span>
                  </div>
                </div>

                {/* Growth insights */}
                <div className={`p-4 rounded-lg ${getTrendColor()}`}>
                  <h4 className="font-semibold mb-2">Growth Insights</h4>
                  <div className="space-y-1 text-sm">
                    {isGrowth && (
                      <>
                        <p>🎉 This creator is growing! They gained {Math.abs(followerChange).toLocaleString()} followers.</p>
                        {growthPercentage > 10 && <p>🚀 This is significant growth of over 10%!</p>}
                        {growthPercentage > 50 && <p>⚡ Exceptional growth of over 50% - they might be going viral!</p>}
                      </>
                    )}
                    {isDecline && (
                      <>
                        <p>📉 This creator lost {Math.abs(followerChange).toLocaleString()} followers.</p>
                        {Math.abs(growthPercentage) < 5 && <p>📊 The decline is minimal (under 5%).</p>}
                        {Math.abs(growthPercentage) > 20 && <p>⚠️ This is a significant decline of over 20%.</p>}
                      </>
                    )}
                    {isNoChange && (
                      <p>➡️ Follower count remained stable with no significant change.</p>
                    )}
                    <p className="text-xs opacity-75">
                      Platform: {platform === 'instagram' ? 'Instagram' : 'TikTok'} • 
                      Analysis period: {previousAnalyzed ? 
                        `${Math.ceil((new Date(lastAnalyzed).getTime() - new Date(previousAnalyzed).getTime()) / (1000 * 60 * 60 * 24))} days` : 
                        'Unknown timespan'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}