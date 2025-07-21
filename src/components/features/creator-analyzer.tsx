"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Platform } from '@/lib/types';

const platforms: { value: Platform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
];

export function CreatorAnalyzer() {
  const [username, setUsername] = useState('');
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    if (!username.trim()) return;
    
    setIsAnalyzing(true);
    
    try {
      // TODO: Implement actual analysis API call
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      console.log('Analyzing:', { username, platform });
    } catch (error) {
      console.error('Analysis failed:', error);
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
            Enter a creator's username to analyze their profile and engagement metrics
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
            {isAnalyzing ? 'Analyzing...' : 'Analyze Creator'}
          </Button>
        </CardContent>
      </Card>

      {/* Results section - placeholder for now */}
      <div className="text-center text-muted-foreground">
        <p>Analysis results will appear here</p>
      </div>
    </div>
  );
} 