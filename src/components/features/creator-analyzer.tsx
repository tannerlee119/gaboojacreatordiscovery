"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Platform } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import Image from 'next/image';

const platforms: { value: Platform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
];

interface AnalysisResult {
  profile: {
    username: string;
    platform: Platform;
    displayName: string;
    bio: string;
    profileImageUrl: string;
    isVerified: boolean;
    followerCount: number;
    followingCount: number;
    location?: string;
    website?: string;
    metrics: any;
    aiAnalysis?: {
      creator_score: string;
      niche: string;
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

export function CreatorAnalyzer() {
  const [username, setUsername] = useState('');
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!username.trim()) return;
    
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    
    try {
      console.log('Starting analysis for:', { username, platform });
      
      const response = await fetch('/api/analyze-creator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username.trim(), platform }),
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Analysis failed');
      }

      setResult(data.data);
      console.log('Analysis completed:', data.data);
      
    } catch (error) {
      console.error('Analysis failed:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="gabooja-card">
        <CardHeader>
          <CardTitle className="text-2xl">Creator Analyzer</CardTitle>
          <CardDescription>
            Enter a creator's username to analyze their profile with AI-powered insights
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Input
                placeholder="Enter username (without @)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                disabled={isAnalyzing}
              />
            </div>
            <div className="flex gap-2">
              {platforms.map((p) => (
                <Button
                  key={p.value}
                  variant={platform === p.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPlatform(p.value)}
                  className="flex-1"
                  disabled={isAnalyzing}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
          
          <Button 
            onClick={handleAnalyze}
            disabled={!username.trim() || isAnalyzing}
            size="lg"
            className="w-full"
          >
            {isAnalyzing ? 'Analyzing... (This may take 30-60 seconds)' : 'Analyze Creator'}
          </Button>

          {isAnalyzing && (
            <div className="text-center space-y-2">
              <div className="animate-pulse text-muted-foreground">
                🤖 Launching browser and taking screenshot...
              </div>
              <div className="text-sm text-muted-foreground">
                We're using Puppeteer to scrape the profile and OpenAI to analyze the content
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
              <CardTitle className="flex items-center gap-3">
                {result.profile.profileImageUrl && (
                  <Image
                    src={result.profile.profileImageUrl}
                    alt={`${result.profile.displayName} profile`}
                    width={60}
                    height={60}
                    className="rounded-full"
                  />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    {result.profile.displayName}
                    {result.profile.isVerified && (
                      <span className="text-primary">✓</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    @{result.profile.username} on {result.profile.platform}
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.profile.bio && (
                <p className="text-sm">{result.profile.bio}</p>
              )}
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold gabooja-accent">
                    {formatNumber(result.profile.followerCount)}
                  </div>
                  <div className="text-sm text-muted-foreground">Followers</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {formatNumber(result.profile.followingCount)}
                  </div>
                  <div className="text-sm text-muted-foreground">Following</div>
                </div>
                {result.profile.metrics?.postCount && (
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {formatNumber(result.profile.metrics.postCount)}
                    </div>
                    <div className="text-sm text-muted-foreground">Posts</div>
                  </div>
                )}
                {result.profile.metrics?.engagementRate && (
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {result.profile.metrics.engagementRate.toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Engagement</div>
                  </div>
                )}
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
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold gabooja-accent">Creator Score</h4>
                      <p className="text-sm">{result.profile.aiAnalysis.creator_score}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold gabooja-accent">Niche</h4>
                      <p className="text-sm">{result.profile.aiAnalysis.niche}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold gabooja-accent">Brand Potential</h4>
                      <p className="text-sm">{result.profile.aiAnalysis.brand_potential}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold gabooja-accent">Key Strengths</h4>
                      <p className="text-sm">{result.profile.aiAnalysis.key_strengths}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold gabooja-accent">Engagement Quality</h4>
                      <p className="text-sm">{result.profile.aiAnalysis.engagement_quality}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold gabooja-accent">Content Style</h4>
                      <p className="text-sm">{result.profile.aiAnalysis.content_style}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold gabooja-accent">Audience Demographics</h4>
                      <p className="text-sm">{result.profile.aiAnalysis.audience_demographics}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold gabooja-accent">Collaboration Potential</h4>
                      <p className="text-sm">{result.profile.aiAnalysis.collaboration_potential}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold gabooja-accent">Overall Assessment</h4>
                  <p className="text-sm">{result.profile.aiAnalysis.overall_assessment}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Screenshot */}
          {result.profile.profileImageBase64 && (
            <Card className="gabooja-card">
              <CardHeader>
                <CardTitle>Profile Screenshot</CardTitle>
                <CardDescription>
                  Screenshot captured during analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Image
                  src={`data:image/png;base64,${result.profile.profileImageBase64}`}
                  alt="Profile screenshot"
                  width={800}
                  height={600}
                  className="w-full rounded-lg border"
                />
              </CardContent>
            </Card>
          )}

          {/* Analysis Details */}
          <Card className="gabooja-card">
            <CardHeader>
              <CardTitle>Analysis Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Method:</strong> {result.scrapingDetails.method}
                </div>
                <div>
                  <strong>Analyzed:</strong> {new Date(result.scrapingDetails.timestamp).toLocaleString()}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
} 