import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function TrendingPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">
          Trending Creators
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Discover the hottest creators and trending content across all platforms.
        </p>
      </div>
      
      <Card className="gabooja-card">
        <CardHeader>
          <CardTitle>Trending Now</CardTitle>
          <CardDescription>
            Top performing creators and viral content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            <p>Trending functionality coming soon...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 