"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface DiscoveryFilters {
  platform: 'all' | 'instagram' | 'tiktok';
  category: string[];
  minFollowers: number;
  maxFollowers: number;
  verified?: boolean;
  sortBy: 'followers' | 'engagement' | 'recent';
}

interface DiscoveryFiltersProps {
  filters: DiscoveryFilters;
  onFiltersChange: (filters: DiscoveryFilters) => void;
  onApplyFilters: () => void;
}

const categories = [
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'beauty', label: 'Beauty' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'sports', label: 'Sports' },
  { value: 'food', label: 'Food' },
  { value: 'travel', label: 'Travel' },
  { value: 'tech', label: 'Tech' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'music', label: 'Music' },
  { value: 'comedy', label: 'Comedy' },
  { value: 'education', label: 'Education' },
  { value: 'business', label: 'Business' },
  { value: 'art', label: 'Art' },
  { value: 'pets', label: 'Pets' },
  { value: 'family', label: 'Family' },
  { value: 'other', label: 'Other' }
];

const followerRanges = [
  { label: 'All', min: 0, max: 10000000 },
  { label: 'Nano (1K-10K)', min: 1000, max: 10000 },
  { label: 'Micro (10K-100K)', min: 10000, max: 100000 },
  { label: 'Mid (100K-1M)', min: 100000, max: 1000000 },
  { label: 'Macro (1M+)', min: 1000000, max: 10000000 }
];

export function DiscoveryFilters({ filters, onFiltersChange, onApplyFilters }: DiscoveryFiltersProps) {
  const [tempFilters, setTempFilters] = useState<DiscoveryFilters>(filters);

  const handlePlatformChange = (platform: 'all' | 'instagram' | 'tiktok') => {
    setTempFilters(prev => ({ ...prev, platform }));
  };

  const handleCategoryToggle = (category: string) => {
    setTempFilters(prev => ({
      ...prev,
      category: prev.category.includes(category)
        ? prev.category.filter(c => c !== category)
        : [...prev.category, category]
    }));
  };

  const handleFollowerRangeChange = (min: number, max: number) => {
    setTempFilters(prev => ({ ...prev, minFollowers: min, maxFollowers: max }));
  };

  const handleVerifiedChange = (verified?: boolean) => {
    setTempFilters(prev => ({ ...prev, verified }));
  };

  const handleSortByChange = (sortBy: 'followers' | 'engagement' | 'recent') => {
    setTempFilters(prev => ({ ...prev, sortBy }));
  };

  const handleApply = () => {
    onFiltersChange(tempFilters);
    onApplyFilters();
  };

  const handleReset = () => {
    const resetFilters: DiscoveryFilters = {
      platform: 'all',
      category: [],
      minFollowers: 0,
      maxFollowers: 10000000,
      verified: undefined,
      sortBy: 'followers'
    };
    setTempFilters(resetFilters);
    onFiltersChange(resetFilters);
    onApplyFilters();
  };

  return (
    <Card className="gabooja-card">
      <CardHeader>
        <CardTitle className="text-lg">Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Platform Filter */}
        <div>
          <h3 className="text-sm font-medium mb-3">Platform</h3>
          <div className="space-y-2">
            {[
              { value: 'all', label: 'All Platforms' },
              { value: 'instagram', label: 'Instagram' },
              { value: 'tiktok', label: 'TikTok' }
            ].map((platform) => (
              <label key={platform.value} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="platform"
                  value={platform.value}
                  checked={tempFilters.platform === platform.value}
                  onChange={() => handlePlatformChange(platform.value as 'all' | 'instagram' | 'tiktok')}
                  className="text-primary"
                />
                <span className="text-sm">{platform.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Follower Range Filter */}
        <div>
          <h3 className="text-sm font-medium mb-3">Follower Count</h3>
          <div className="space-y-2">
            {followerRanges.map((range) => (
              <label key={range.label} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="followerRange"
                  checked={tempFilters.minFollowers === range.min && tempFilters.maxFollowers === range.max}
                  onChange={() => handleFollowerRangeChange(range.min, range.max)}
                  className="text-primary"
                />
                <span className="text-sm">{range.label}</span>
              </label>
            ))}
          </div>
          
          {/* Custom Range */}
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground mb-2">Custom Range</p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={tempFilters.minFollowers || ''}
                onChange={(e) => setTempFilters(prev => ({ 
                  ...prev, 
                  minFollowers: parseInt(e.target.value) || 0 
                }))}
                className="text-xs"
              />
              <Input
                type="number"
                placeholder="Max"
                value={tempFilters.maxFollowers === 10000000 ? '' : tempFilters.maxFollowers}
                onChange={(e) => setTempFilters(prev => ({ 
                  ...prev, 
                  maxFollowers: parseInt(e.target.value) || 10000000 
                }))}
                className="text-xs"
              />
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <div>
          <h3 className="text-sm font-medium mb-3">Categories</h3>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((category) => (
              <label key={category.value} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tempFilters.category.includes(category.value)}
                  onChange={() => handleCategoryToggle(category.value)}
                  className="text-primary"
                />
                <span className="text-xs">{category.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Verification Filter */}
        <div>
          <h3 className="text-sm font-medium mb-3">Verification</h3>
          <div className="space-y-2">
            {[
              { value: undefined, label: 'All' },
              { value: true, label: 'Verified Only' },
              { value: false, label: 'Unverified Only' }
            ].map((option, index) => (
              <label key={index} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="verified"
                  checked={tempFilters.verified === option.value}
                  onChange={() => handleVerifiedChange(option.value)}
                  className="text-primary"
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Sort By Filter */}
        <div>
          <h3 className="text-sm font-medium mb-3">Sort By</h3>
          <div className="space-y-2">
            {[
              { value: 'followers', label: 'Follower Count' },
              { value: 'engagement', label: 'Engagement Rate' },
              { value: 'recent', label: 'Recently Active' }
            ].map((sort) => (
              <label key={sort.value} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="sortBy"
                  value={sort.value}
                  checked={tempFilters.sortBy === sort.value}
                  onChange={() => handleSortByChange(sort.value as 'followers' | 'engagement' | 'recent')}
                  className="text-primary"
                />
                <span className="text-sm">{sort.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-4 border-t">
          <Button onClick={handleApply} className="w-full" size="sm">
            Apply Filters
          </Button>
          <Button onClick={handleReset} variant="outline" className="w-full" size="sm">
            Reset All
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}