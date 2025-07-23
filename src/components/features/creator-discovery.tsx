"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCreator } from '@/lib/creator-context';
import { formatNumber } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export function CreatorDiscovery() {
  const { analysisHistory, setCurrentAnalysis } = useCreator();
  const router = useRouter();

  const handleViewAnalysis = (analysis: typeof analysisHistory[0]) => {
    setCurrentAnalysis(analysis);
    router.push('/');
  };

  return (
    <div className="space-y-6">
      <Card className="gabooja-card">
        <CardHeader>
          <CardTitle>Creator Discovery</CardTitle>
          <CardDescription>
            Discover creators across different platforms and categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            <p>Creator discovery functionality coming soon...</p>
          </div>
        </CardContent>
      </Card>

      {analysisHistory.length > 0 && (
        <Card className="gabooja-card">
          <CardHeader>
            <CardTitle>Recent Analyses</CardTitle>
            <CardDescription>
              Your recently analyzed creators persist across navigation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {analysisHistory.slice(0, 5).map((analysis) => (
                <div key={`${analysis.profile.username}-${analysis.profile.platform}`} 
                     className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {analysis.profile.profileImageUrl ? (
                      <Image
                        src={analysis.profile.profileImageUrl}
                        alt={`${analysis.profile.displayName} profile`}
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-[40px] h-[40px] rounded-full bg-muted flex items-center justify-center">
                        <span className="text-sm font-semibold text-muted-foreground">
                          {analysis.profile.displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div>
                      <div className="font-medium">
                        {analysis.profile.displayName}
                        {analysis.profile.isVerified && <span className="ml-1 text-primary">✓</span>}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        @{analysis.profile.username} • {analysis.profile.platform} • {formatNumber(analysis.profile.followerCount)} followers
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewAnalysis(analysis)}
                  >
                    View Analysis
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 