"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCreator } from '@/lib/creator-context';
import { formatNumber } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { AnalysisModal } from '@/components/ui/analysis-modal';

export function CreatorDiscovery() {
  const { analysisHistory } = useCreator();
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleViewAnalysis = (analysis: typeof analysisHistory[0]) => {
    setSelectedAnalysis(analysis);
    setIsModalOpen(true);
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
                    <div>
                      <div className="font-medium">
                        {analysis.profile.platform === 'instagram' ? `@${analysis.profile.username}` : analysis.profile.displayName}
                        {analysis.profile.isVerified && <span className="ml-1 text-primary">✓</span>}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          analysis.profile.platform === 'instagram' 
                            ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
                            : analysis.profile.platform === 'tiktok'
                            ? 'bg-black text-white dark:bg-white dark:text-black'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}>
                          {analysis.profile.platform}
                        </span>
                        • {formatNumber(analysis.profile.followerCount)} followers
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
    </div>
  );
} 