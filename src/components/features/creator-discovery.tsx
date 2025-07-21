"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function CreatorDiscovery() {
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
    </div>
  );
} 