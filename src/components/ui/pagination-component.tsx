"use client";

import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function PaginationComponent({
  currentPage,
  totalPages,
  onPageChange,
  isLoading = false
}: PaginationProps) {
  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('...');
      }
      
      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        if (i > 1 && i < totalPages) {
          pages.push(i);
        }
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      
      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {/* Previous button */}
      <Button
        variant="outline"
        size="sm"
        disabled={currentPage === 1 || isLoading}
        onClick={() => onPageChange(currentPage - 1)}
        className="text-xs cursor-pointer hover:bg-primary/10 hover:text-foreground hover:border-primary/30 transition-all duration-200 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <ChevronLeft className="h-3 w-3 mr-1" />
        Previous
      </Button>

      {/* Page numbers */}
      <div className="flex items-center gap-1">
        {pageNumbers.map((page, index) => {
          if (page === '...') {
            return (
              <span
                key={`ellipsis-${index}`}
                className="px-2 py-1 text-sm text-muted-foreground"
              >
                ...
              </span>
            );
          }

          const pageNum = page as number;
          const isCurrentPage = pageNum === currentPage;

          return (
            <Button
              key={pageNum}
              variant={isCurrentPage ? "default" : "outline"}
              size="sm"
              disabled={isLoading}
              onClick={() => onPageChange(pageNum)}
              className={`text-xs min-w-[32px] h-8 px-2 cursor-pointer transition-all duration-200 disabled:cursor-not-allowed ${
                isCurrentPage
                  ? ''
                  : 'hover:bg-primary/10 hover:text-foreground hover:border-primary/30 disabled:hover:bg-transparent'
              }`}
            >
              {pageNum}
            </Button>
          );
        })}
      </div>

      {/* Next button */}
      <Button
        variant="outline"
        size="sm"
        disabled={currentPage === totalPages || isLoading}
        onClick={() => onPageChange(currentPage + 1)}
        className="text-xs cursor-pointer hover:bg-primary/10 hover:text-foreground hover:border-primary/30 transition-all duration-200 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        Next
        <ChevronRight className="h-3 w-3 ml-1" />
      </Button>
    </div>
  );
}