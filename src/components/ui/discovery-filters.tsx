"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface DiscoveryFilters {
  platform: 'all' | 'instagram' | 'tiktok';
  category: string[];
  minFollowers: number;
  maxFollowers: number;
  verified?: boolean;
  sortBy: 'followers-desc' | 'followers-asc';
}

interface DiscoveryFiltersProps {
  filters: DiscoveryFilters;
  onFiltersChange: (filters: DiscoveryFilters) => void;
  onApplyFilters: (filters?: DiscoveryFilters) => void;
  isLoading?: boolean;
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

export function DiscoveryFilters({ filters, onFiltersChange, onApplyFilters, isLoading = false }: DiscoveryFiltersProps) {
  // Use temporary state to stage changes before applying
  const [tempFilters, setTempFilters] = useState<DiscoveryFilters>(filters);
  const [isExpanded, setIsExpanded] = useState(false);

  // Update tempFilters when filters prop changes (for reset functionality)
  useEffect(() => {
    setTempFilters(filters);
  }, [filters]);

  // Count active filters
  const getActiveFilterCount = (filterSet: DiscoveryFilters) => {
    let count = 0;
    if (filterSet.platform !== 'all') count++;
    if (filterSet.category.length > 0) count++;
    if (filterSet.minFollowers > 0 || filterSet.maxFollowers < 10000000) count++;
    if (filterSet.verified !== undefined) count++;
    if (filterSet.sortBy !== 'followers-desc') count++;
    return count;
  };

  const activeFilterCount = getActiveFilterCount(tempFilters);

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

  const handleSortByChange = (sortBy: 'followers-desc' | 'followers-asc') => {
    setTempFilters(prev => ({ ...prev, sortBy }));
  };

  const handleCustomFollowerChange = (field: 'minFollowers' | 'maxFollowers', value: number) => {
    setTempFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleApply = () => {
    onFiltersChange(tempFilters);
    onApplyFilters(tempFilters); // Pass the filters directly to ensure immediate application
  };

  const handleReset = () => {
    const resetFilters: DiscoveryFilters = {
      platform: 'all',
      category: [],
      minFollowers: 0,
      maxFollowers: 10000000,
      verified: undefined,
      sortBy: 'followers-desc'
    };
    setTempFilters(resetFilters);
    onFiltersChange(resetFilters);
    onApplyFilters(resetFilters); // Pass the reset filters directly
  };

  return (
    <Card className="gabooja-card">
      <CardHeader 
        className="cursor-pointer lg:cursor-default"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {activeFilterCount} active
              </Badge>
            )}
          </div>
          <div className="lg:hidden">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className={`space-y-6 lg:block ${isExpanded ? 'block' : 'hidden'}`}>
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

        {/* Sort By Filter */}
        <div>
          <h3 className="text-sm font-medium mb-3">Sort By</h3>
          <div className="space-y-2">
            {[
              { value: 'followers-desc', label: 'Highest to Lowest Followers' },
              { value: 'followers-asc', label: 'Lowest to Highest Followers' }
            ].map((sort) => (
              <label key={sort.value} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="sortBy"
                  value={sort.value}
                  checked={tempFilters.sortBy === sort.value}
                  onChange={() => handleSortByChange(sort.value as 'followers-desc' | 'followers-asc')}
                  className="text-primary"
                />
                <span className="text-sm">{sort.label}</span>
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
                onChange={(e) => handleCustomFollowerChange('minFollowers', parseInt(e.target.value) || 0)}
                className="text-xs"
              />
              <Input
                type="number"
                placeholder="Max"
                value={tempFilters.maxFollowers === 10000000 ? '' : tempFilters.maxFollowers}
                onChange={(e) => handleCustomFollowerChange('maxFollowers', parseInt(e.target.value) || 10000000)}
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

        {/* Action Buttons */}
        <div className="space-y-2 pt-4 border-t">
          <Button 
            onClick={handleApply} 
            className="w-full text-xs" 
            size="sm"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                Applying...
              </>
            ) : (
              'Apply Filters'
            )}
          </Button>
          <Button 
            onClick={handleReset} 
            variant="outline" 
            className="w-full text-xs hover:bg-primary/10 hover:text-foreground hover:border-primary/30 transition-all duration-200" 
            size="sm"
            disabled={isLoading}
          >
            Reset All
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}