"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  creatorUsername: string;
  platform: string;
}

export function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  creatorUsername,
  platform
}: DeleteConfirmationModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      // Save preference if checkbox is checked
      if (dontShowAgain) {
        localStorage.setItem('gabooja_skip_delete_confirmation', 'true');
      }
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Error deleting bookmark:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Delete Bookmark
          </DialogTitle>
          <DialogDescription className="text-left">
            Are you sure you want to remove <strong>@{creatorUsername}</strong> from your {platform} bookmarks?
          </DialogDescription>
        </DialogHeader>

        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="text-sm">
            <p className="font-medium text-red-800 dark:text-red-200 mb-1">
              This action cannot be undone
            </p>
            <p className="text-red-700 dark:text-red-300">
              The creator will be permanently removed from your bookmarks, including any notes you&apos;ve added.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="dont-show-again"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
          />
          <Label
            htmlFor="dont-show-again"
            className="text-sm text-muted-foreground cursor-pointer"
          >
            Don&apos;t show this confirmation again
          </Label>
        </div>

        <DialogFooter className="justify-start gap-2">
          <Button
            className="bg-red-500 hover:bg-red-600 text-white text-xs transition-all duration-200"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isDeleting ? 'Deleting...' : 'Delete Bookmark'}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
            className="text-xs hover:bg-primary/10 hover:text-foreground hover:border-primary/30 transition-all duration-200"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}