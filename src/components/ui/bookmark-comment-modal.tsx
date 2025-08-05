"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MessageSquare, Save, X } from 'lucide-react';

interface BookmarkCommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (comments: string) => void;
  creatorUsername: string;
  platform: string;
  initialComments?: string;
  isEditing?: boolean;
}

export function BookmarkCommentModal({
  isOpen,
  onClose,
  onSave,
  creatorUsername,
  platform,
  initialComments = '',
  isEditing = false
}: BookmarkCommentModalProps) {
  const [comments, setComments] = useState(initialComments);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    try {
      onSave(comments);
      onClose();
    } catch (error) {
      console.error('Error saving comments:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setComments(initialComments); // Reset to initial value
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {isEditing ? 'Edit Notes' : 'Add Notes'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? `Edit your notes for @${creatorUsername} on ${platform}`
              : `Add personal notes for @${creatorUsername} on ${platform}`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <Label htmlFor="comments" className="text-base font-medium">Your Notes</Label>
            <Textarea
              id="comments"
              placeholder="Add your thoughts, collaboration ideas, contact details, or any other notes about this creator..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={8}
              className="resize-none text-base"
            />
            <p className="text-xs text-muted-foreground">
              These notes are only visible to you and will be saved with your bookmark.
            </p>
          </div>
        </div>

        <DialogFooter className="justify-start gap-2">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="text-xs hover:bg-primary/90 hover:text-primary-foreground transition-all duration-200"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Notes'}
          </Button>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSaving}
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