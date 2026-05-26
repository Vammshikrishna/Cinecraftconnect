import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, X, Plus, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PostActionsDialogsProps {
  postId: string;
  content: string;
  mediaItems: { url: string; type: 'image' | 'video' }[];
  isEditOpen: boolean;
  setIsEditOpen: (open: boolean) => void;
  isDeleteOpen: boolean;
  setIsDeleteOpen: (open: boolean) => void;
  onUpdateSuccess: (newContent: string, newMedia: any[]) => void;
  onDeleteSuccess: () => void;
  userId?: string;
}

const PostActionsDialogs = ({
  postId,
  content,
  mediaItems,
  isEditOpen,
  setIsEditOpen,
  isDeleteOpen,
  setIsDeleteOpen,
  onUpdateSuccess,
  onDeleteSuccess,
  userId
}: PostActionsDialogsProps) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [editMediaItems, setEditMediaItems] = useState(mediaItems);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setIsUploading(true);
    try {
      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
      let fileToUpload = file;

      if (mediaType === 'image') {
        const { compressImage } = await import('@/utils/imageCompression');
        fileToUpload = await compressImage(file);
      }

      const fileExt = fileToUpload.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}_${fileToUpload.name.replace(/[^a-zA-Z0-9.]/g, '_')}.${fileExt}`;
      const filePath = `posts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('portfolios')
        .upload(filePath, fileToUpload, {
          cacheControl: '31536000',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('portfolios')
        .getPublicUrl(filePath);
      
      setEditMediaItems(prev => [...prev, { url: data.publicUrl, type: mediaType as 'image' | 'video' }]);
      
      toast({
        title: "Success",
        description: "Media uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUpdate = async () => {
    if (!editContent.trim() && editMediaItems.length === 0) {
      toast({
        title: "Error",
        description: "Post must have either text or media",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      let finalContent = editContent.trim();

      // Preserve JOB_SHARE metadata if it exists
      if (content.includes('JOB_SHARE::')) {
        const parts = content.split('JOB_SHARE::');
        const jsonPart = parts[parts.length - 1];
        finalContent = finalContent ? `${finalContent}\n\nJOB_SHARE::${jsonPart}` : `JOB_SHARE::${jsonPart}`;
      }

      const { error } = await supabase
        .from('posts')
        .update({
          content: finalContent,
          media_items: editMediaItems,
          media_url: editMediaItems.length > 0 ? editMediaItems[0].url : null,
          media_type: editMediaItems.length > 0 ? editMediaItems[0].type : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', postId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Post updated successfully",
      });
      onUpdateSuccess(finalContent, editMediaItems);
      setIsEditOpen(false);
    } catch (error) {
      console.error('Error updating post:', error);
      toast({
        title: "Error",
        description: "Failed to update post",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Post deleted successfully",
      });
      onDeleteSuccess();
      setIsDeleteOpen(false);
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: "Error",
        description: "Failed to delete post",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-lg bg-background/95 backdrop-blur-3xl border-white/10 shadow-2xl rounded-[32px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Edit Post</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Update your thoughts or findings below.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="What's happening?"
              className="min-h-[150px] bg-white/5 border-white/10 rounded-2xl focus:ring-primary/50 text-foreground resize-none"
              autoFocus
            />

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest px-1">Manage Media ({editMediaItems.length})</p>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {editMediaItems.map((item, idx) => (
                  <div key={idx} className="relative group/edit flex-shrink-0 w-24 aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-primary/50 transition-all duration-300">
                    {item.type === 'image' ? (
                      <img src={item.url} className="w-full h-full object-cover" alt="Edit thumbnail" />
                    ) : (
                      <div className="w-full h-full bg-black/40 flex items-center justify-center relative">
                        <Play className="w-6 h-6 text-white fill-white opacity-50" />
                        <video src={item.url} preload="none" className="w-full h-full object-cover absolute inset-0 opacity-40" />
                      </div>
                    )}

                    <button
                      onClick={() => setEditMediaItems(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 h-6 w-6 bg-red-500 rounded-full flex items-center justify-center text-white p-1 shadow-lg transform translate-x-8 group-hover/edit:translate-x-0 transition-transform duration-300 hover:bg-black"
                    >
                      <X size={14} strokeWidth={3} />
                    </button>
                  </div>
                ))}
                
                <div 
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  className={cn(
                    "w-24 aspect-square rounded-xl border-2 border-dashed border-white/10 hover:border-primary/50 flex flex-col items-center justify-center cursor-pointer transition-all group/add shrink-0 bg-white/5 hover:bg-primary/5",
                    isUploading && "cursor-not-allowed opacity-70"
                  )}
                >
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-6 w-6 text-muted-foreground group-hover/add:text-primary transition-colors" />
                      <span className="text-[9px] font-black text-muted-foreground group-hover/add:text-primary mt-1 uppercase tracking-[0.2em]">Add</span>
                    </>
                  )}
                </div>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*,video/*" 
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsEditOpen(false)} className="rounded-xl hover:bg-white/5">
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isSaving} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl px-8 shadow-lg shadow-primary/20">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="bg-background/95 backdrop-blur-3xl border-white/10 shadow-2xl rounded-[32px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-red-500">Delete Post?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This action cannot be undone. This post will be permanently removed from the feed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-xl hover:bg-white/5 border-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl px-8 shadow-lg shadow-red-600/20 border-none">
              {isDeleting ? "Deleting..." : "Delete Post"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PostActionsDialogs;
