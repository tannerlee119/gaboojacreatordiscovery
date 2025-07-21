import { CreatorDiscovery } from '@/components/features/creator-discovery';

export default function DiscoveryPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">
          Discover Creators
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Browse through our curated collection of creators. Filter by platform, 
          category, follower count, and more to find the perfect match for your needs.
        </p>
      </div>
      
      <CreatorDiscovery />
    </div>
  );
} 