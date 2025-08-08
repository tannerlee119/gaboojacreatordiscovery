import { CreatorAnalyzer } from '@/components/features/creator-analyzer';

export default function AnalyzePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="text-center mb-12 gabooja-hero-bg rounded-2xl py-16 px-8">
        <h1 className="text-4xl md:text-6xl font-bold gabooja-gradient mb-6">
          Gabooja Creator Discovery
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Analyze Instagram and TikTok creators with real-time engagement metrics. 
          Get detailed insights on followers, posts, and videos with AI powered analysis.
        </p>
      </div>

      {/* Main Analyzer Component */}
      <CreatorAnalyzer />
    </div>
  );
} 