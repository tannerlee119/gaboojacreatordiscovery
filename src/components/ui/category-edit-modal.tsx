"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreatorCategory } from '@/lib/types';

const categories: { value: CreatorCategory; label: string; icon: string }[] = [
  { value: 'art', label: 'Art', icon: '🎨' },
  { value: 'beauty', label: 'Beauty', icon: '💄' },
  { value: 'business', label: 'Business', icon: '💼' },
  { value: 'comedy', label: 'Comedy', icon: '😂' },
  { value: 'education', label: 'Education', icon: '📚' },
  { value: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦' },
  { value: 'fashion', label: 'Fashion', icon: '👗' },
  { value: 'fitness', label: 'Fitness', icon: '💪' },
  { value: 'food', label: 'Food', icon: '🍳' },
  { value: 'gaming', label: 'Gaming', icon: '🎮' },
  { value: 'lifestyle', label: 'Lifestyle', icon: '🌱' },
  { value: 'music', label: 'Music', icon: '🎵' },
  { value: 'other', label: 'Other', icon: '📁' },
  { value: 'pets', label: 'Pets', icon: '🐕' },
  { value: 'sports', label: 'Sports', icon: '⚽' },
  { value: 'tech', label: 'Tech', icon: '💻' },
  { value: 'travel', label: 'Travel', icon: '✈️' }
];

interface CategoryEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCategory: string;
  onCategoryChange: (newCategory: CreatorCategory) => void;
  creatorUsername?: string;
}

export function CategoryEditModal({ 
  isOpen, 
  onClose, 
  currentCategory, 
  onCategoryChange, 
  creatorUsername 
}: CategoryEditModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<CreatorCategory>(
    categories.find(c => c.value === currentCategory.toLowerCase())?.value || 'other'
  );

  const handleSave = () => {
    onCategoryChange(selectedCategory);
    onClose();
  };

  const handleCancel = () => {
    setSelectedCategory(categories.find(c => c.value === currentCategory.toLowerCase())?.value || 'other');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
          <DialogDescription>
            {creatorUsername ? `Change the category for @${creatorUsername}` : 'Select the most appropriate category for this creator'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="grid grid-cols-2 gap-3">
            {categories.map((category) => (
              <label key={category.value} className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-2 rounded-md transition-colors">
                <input
                  type="radio"
                  name="category"
                  value={category.value}
                  checked={selectedCategory === category.value}
                  onChange={() => setSelectedCategory(category.value)}
                  className="text-primary"
                />
                <span className="text-base">{category.icon}</span>
                <span className="text-sm">{category.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Category
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}