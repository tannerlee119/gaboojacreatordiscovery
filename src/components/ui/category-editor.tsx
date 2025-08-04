"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CategoryEditModal } from '@/components/ui/category-edit-modal';
import { CreatorCategory } from '@/lib/types';
import { Edit3 } from 'lucide-react';

interface CategoryEditorProps {
  currentCategory: string;
  onCategoryChange: (newCategory: CreatorCategory) => void;
  disabled?: boolean;
  creatorUsername?: string;
}

export function CategoryEditor({ currentCategory, onCategoryChange, disabled = false, creatorUsername }: CategoryEditorProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCategoryChange = (newCategory: CreatorCategory) => {
    onCategoryChange(newCategory);
  };

  return (
    <>
      <div className="relative w-full">
        <div className="text-3xl font-bold text-blue-700 dark:text-blue-300 text-center">
          {currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1)}
        </div>
        {!disabled && (
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => setIsModalOpen(true)}
            className="absolute top-0 right-0 h-5 w-5 p-0 opacity-50 hover:opacity-100 transition-opacity"
          >
            <Edit3 className="h-2.5 w-2.5" />
          </Button>
        )}
      </div>

      <CategoryEditModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentCategory={currentCategory}
        onCategoryChange={handleCategoryChange}
        creatorUsername={creatorUsername}
      />
    </>
  );
}