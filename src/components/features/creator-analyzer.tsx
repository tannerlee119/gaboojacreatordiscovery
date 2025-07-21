"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Platform } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import Image from 'next/image';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

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
    metrics: {
      followerCount?: number;
      followingCount?: number;
      postCount?: number;
      engagementRate?: number;
    };
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
  const [isScreenshotOpen, setIsScreenshotOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

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
            Enter a creator&apos;s username to analyze their profile with AI-powered insights
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
                We&apos;re using Puppeteer to scrape the profile and OpenAI to analyze the content
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
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
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
                {result.profile.metrics && typeof result.profile.metrics.postCount === 'number' && (
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {formatNumber(result.profile.metrics.postCount)}
                    </div>
                    <div className="text-sm text-muted-foreground">Posts</div>
                  </div>
                )}
              </div>
              
              {/* Profile Link at bottom */}
              <div className="pt-4 border-t border-border">
                <a
                  href={`https://www.${result.profile.platform}.com/${result.profile.username}`}
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
                     <div className="grid md:grid-cols-3 gap-6 items-start">
                       {/* Creator Score */}
                       <div className="text-center p-6 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
                         <div className="text-sm font-medium gabooja-accent mb-2">Creator Score</div>
                         <div className="text-4xl font-bold gabooja-accent mb-2">
                           {(() => {
                             const scoreText = result.profile.aiAnalysis.creator_score;
                             const scoreMatch = scoreText.match(/^(\d+(?:\.\d+)?(?:\/\d+)?)/);
                             return scoreMatch ? scoreMatch[1] : scoreText;
                           })()}
                         </div>
                         <div className="text-xs text-muted-foreground">Overall Rating</div>
                       </div>
                       
                       {/* Niche */}
                       <div className="text-center p-6 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800">
                         <div className="text-sm font-medium gabooja-accent mb-2">Niche</div>
                         <div className="text-lg font-semibold text-blue-700 dark:text-blue-300 line-clamp-2">
                           {result.profile.aiAnalysis.niche}
                         </div>
                       </div>
                       
                       {/* Key Insight */}
                       <div className="text-center p-6 rounded-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20 border border-green-200 dark:border-green-800">
                         <div className="text-sm font-medium gabooja-accent mb-2">Brand Potential</div>
                         <div className="text-lg font-semibold text-green-700 dark:text-green-300">
                           {result.profile.aiAnalysis.brand_potential}
                         </div>
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
                           const scoreText = result.profile.aiAnalysis.creator_score;
                           const explanationMatch = scoreText.match(/^(?:\d+(?:\.\d+)?(?:\/\d+)?\s*-?\s*)(.+)$/);
                           return explanationMatch ? explanationMatch[1].trim() : 'Detailed analysis of creator performance and potential.';
                         })()}
                       </p>
                     </div>
                   </TabsContent>
                   
                   <TabsContent value="metrics" className="space-y-6">
                     <div className="grid md:grid-cols-2 gap-6">
                       <div className="p-6 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800">
                         <h4 className="font-semibold gabooja-accent flex items-center gap-2 mb-3 text-lg">
                           🎯 Brand Potential
                         </h4>
                         <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mb-2">
                           {result.profile.aiAnalysis.brand_potential}
                         </p>
                         <p className="text-sm text-blue-600 dark:text-blue-400">
                           Potential for brand partnerships and collaborations
                         </p>
                       </div>
                       
                       <div className="p-6 rounded-lg bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20 border border-green-200 dark:border-green-800">
                         <h4 className="font-semibold gabooja-accent flex items-center gap-2 mb-3 text-lg">
                           💬 Engagement Quality
                         </h4>
                         <p className="text-2xl font-bold text-green-700 dark:text-green-300 mb-2">
                           {result.profile.aiAnalysis.engagement_quality}
                         </p>
                         <p className="text-sm text-green-600 dark:text-green-400">
                           Quality and authenticity of audience interactions
                         </p>
                       </div>
                       
                       <div className="p-6 rounded-lg bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 border border-purple-200 dark:border-purple-800">
                         <h4 className="font-semibold gabooja-accent flex items-center gap-2 mb-3 text-lg">
                           🤝 Collaboration Potential
                         </h4>
                         <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mb-2">
                           {result.profile.aiAnalysis.collaboration_potential}
                         </p>
                         <p className="text-sm text-purple-600 dark:text-purple-400">
                           Likelihood of successful partnerships
                         </p>
                       </div>
                       
                       <div className="p-6 rounded-lg bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-950/20 dark:to-amber-900/20 border border-amber-200 dark:border-amber-800">
                         <h4 className="font-semibold gabooja-accent flex items-center gap-2 mb-3 text-lg">
                           🏷️ Niche Focus
                         </h4>
                         <p className="text-base leading-relaxed">{result.profile.aiAnalysis.niche}</p>
                       </div>
                     </div>
                   </TabsContent>
                   
                   <TabsContent value="content" className="space-y-6">
                     <div className="grid md:grid-cols-2 gap-6">
                       <div className="p-6 rounded-lg bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/20 dark:to-pink-950/20 border border-rose-200 dark:border-rose-800">
                         <h4 className="font-semibold gabooja-accent flex items-center gap-2 mb-4 text-lg">
                           🎭 Content Style
                         </h4>
                         <p className="text-base leading-relaxed">{result.profile.aiAnalysis.content_style}</p>
                       </div>
                       
                       <div className="p-6 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800">
                         <h4 className="font-semibold gabooja-accent flex items-center gap-2 mb-4 text-lg">
                           💪 Key Strengths
                         </h4>
                         <p className="text-base leading-relaxed">{result.profile.aiAnalysis.key_strengths}</p>
                       </div>
                       
                       <div className="p-6 rounded-lg bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 border border-indigo-200 dark:border-indigo-800 md:col-span-2">
                         <h4 className="font-semibold gabooja-accent flex items-center gap-2 mb-4 text-lg">
                           👥 Audience Demographics
                         </h4>
                         <p className="text-base leading-relaxed">{result.profile.aiAnalysis.audience_demographics}</p>
                       </div>
                     </div>
                   </TabsContent>
                   
                   <TabsContent value="assessment" className="space-y-6">
                     <div className="p-8 rounded-lg bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/30 border border-slate-200 dark:border-slate-700">
                       <h4 className="font-semibold gabooja-accent flex items-center gap-2 mb-6 text-xl">
                         📝 Overall Assessment
                       </h4>
                       <p className="text-lg leading-relaxed">{result.profile.aiAnalysis.overall_assessment}</p>
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
                 <div className="grid md:grid-cols-2 gap-4 text-sm">
                   <div>
                     <strong>Method:</strong> {result.scrapingDetails.method}
                   </div>
                   <div>
                     <strong>Analyzed:</strong> {new Date(result.scrapingDetails.timestamp).toLocaleString()}
                   </div>
                 </div>
               </CardContent>
             )}
           </Card>
        </div>
      )}
    </div>
  );
} 