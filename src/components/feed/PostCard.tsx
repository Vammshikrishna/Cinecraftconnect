import { Heart, MessageCircle, Play, MoreVertical, Edit, Trash2, Loader2, X, ChevronLeft, ChevronRight, Share2, Bookmark, Flag, Plus } from "lucide-react";
import ReportDialog from "../common/ReportDialog";
import VerificationBadge from "../common/VerificationBadge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CommentSection from "./CommentSection";
import ShareButton from "../ShareButton";
import { useToast } from "@/hooks/use-toast";
import { togglePostLike } from "@/services/postService";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { usePostBookmarks } from "@/hooks/usePostBookmarks";
import { useRealtimePostStats } from "@/hooks/useRealtimePostStats";
import { useAppRole } from "@/hooks/useAppRole";
import { FormattedText } from "@/components/ui/formatted-text";
import { JobShareCard } from "@/components/chat/JobShareCard";
import { cn } from "@/lib/utils";
import { getOptimizedImage } from "@/utils/image-optimization";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { StaffBadge } from "../internal/shared/StaffBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Textarea } from "@/components/ui/textarea";

interface PostAuthor {
  id?: string;
  name: string;
  role: string;
  craft?: string;
  initials: string;
  avatar?: string;
  isVerified?: boolean;
}

interface PostProps {
  id: string;
  author: PostAuthor;
  timeAgo: string;
  content: string;
  hasImage?: boolean;
  imageAlt?: string;
  hasVideo?: boolean;
  videoThumbnail?: string;
  isAIGenerated?: boolean;
  like_count: number;
  comment_count: number;
  share_count: number;
  tags?: string[];
  rating?: number;
  currentUserLiked?: boolean;
  onRate?: (postId: string, rating: number) => void;
  onLikeToggle?: (postId: string, isLiked: boolean) => void;
  mediaUrl?: string;
  mediaItems?: { url: string; type: "image" | "video" }[];
  createdAt?: string;
  onDelete?: (postId: string) => void;
  pageInfo?: {
    id: string;
    name: string;
    logo_url: string | null;
    slug: string;
  };
  authorId?: string;
}

const PostCard = ({
  id,
  author,
  timeAgo,
  content,
  hasImage,
  imageAlt,
  hasVideo,
  isAIGenerated,
  like_count,
  comment_count,
  share_count,
  tags,
  currentUserLiked,
  onLikeToggle,
  mediaUrl,
  mediaItems,
  createdAt,
  onDelete,
  pageInfo,
  authorId
}: PostProps) => {

  const [showComments, setShowComments] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Edit/Delete State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Bookmarks
  const { bookmarkedPostIds, toggleBookmark } = usePostBookmarks();
  const isBookmarked = bookmarkedPostIds.has(id);
  const isTogglingBookmark = toggleBookmark.isPending;
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [editMediaItems, setEditMediaItems] = useState<{ url: string, type: 'image' | 'video' }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}.${fileExt}`;
      const filePath = `posts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('portfolios')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('portfolios')
        .getPublicUrl(filePath);

      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
      
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

  // Real-time metrics
  const { likeCount: displayLikeCount, commentCount: displayCommentCount } = useRealtimePostStats(id, like_count, comment_count);

  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldShowMore, setShouldShowMore] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkTruncation = () => {
      if (contentRef.current && !isExpanded) {
        const hasMore = contentRef.current.scrollHeight > contentRef.current.clientHeight;
        setShouldShowMore(hasMore);
      }
    };

    // Delay slightly to ensure layout is done
    const timer = setTimeout(checkTruncation, 100);
    window.addEventListener('resize', checkTruncation);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkTruncation);
    };
  }, [content, isExpanded]);

  // Reset expansion state when content changes (e.g. after edit)
  useEffect(() => {
    setIsExpanded(false);
    setShouldShowMore(false);
  }, [content]);

  // Initialize edit state when dialog opens
  useEffect(() => {
    if (isEditOpen) {
      if (content.includes('JOB_SHARE::')) {
        const parts = content.split('JOB_SHARE::');
        const caption = parts[0].trim();
        setEditContent(caption);
      } else {
        setEditContent(content);
      }

      const items = Array.isArray(mediaItems) ? [...mediaItems] : [];
      if (items.length === 0 && (hasImage || hasVideo)) {
        items.push({ url: mediaUrl || "", type: hasImage ? "image" : "video" });
      }
      setEditMediaItems(items);
    }
  }, [isEditOpen, content, mediaItems, hasImage, hasVideo, mediaUrl]);

  const [isReportOpen, setIsReportOpen] = useState(false);

  const { isAdmin, isInternal } = useAppRole();
  const isOwner = user?.id === author.id || user?.id === authorId;
  const canManage = isOwner || isAdmin;

  // View States
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewIndex, setViewIndex] = useState(0);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const wheelTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Common handler for touch and mouse ends
  const processSwipe = (max: number, isViewer: boolean) => {
    if (touchStart === null || touchEnd === null) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isViewer) {
      if (isLeftSwipe && viewIndex < max - 1) nextMedia(max);
      if (isRightSwipe && viewIndex > 0) prevMedia(max);
    } else {
      if (isLeftSwipe && currentMediaIndex < max - 1) setCurrentMediaIndex(prev => prev + 1);
      if (isRightSwipe && currentMediaIndex > 0) setCurrentMediaIndex(prev => prev - 1);
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setTouchEnd(null);
    setTouchStart(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (touchStart !== null) {
      setTouchEnd(e.clientX);
    }
  };

  const handleWheel = (e: React.WheelEvent, max: number, isViewer: boolean = false) => {
    // Only react to significant horizontal scrolling
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 20) {
      if (wheelTimeout.current) return; // Cooldown active

      if (e.deltaX > 0) {
        // Swipe left
        if (isViewer) {
          if (viewIndex < max - 1) nextMedia(max);
        } else {
          if (currentMediaIndex < max - 1) setCurrentMediaIndex(prev => prev + 1);
        }
      } else {
        // Swipe right
        if (isViewer) {
          if (viewIndex > 0) prevMedia(max);
        } else {
          if (currentMediaIndex > 0) setCurrentMediaIndex(prev => prev - 1);
        }
      }

      // 400ms cooldown to prevent flying through images
      wheelTimeout.current = setTimeout(() => {
        wheelTimeout.current = null;
      }, 400);
    }
  };

  const nextMedia = (max: number) => {
    setViewIndex((prev) => (prev + 1) % max);
  };

  const prevMedia = (max: number) => {
    setViewIndex((prev) => (prev - 1 + max) % max);
  };

  const isLiked = currentUserLiked || false;

  const handleLike = async () => {
    if (isLiking) return;

    setIsLiking(true);

    // Call the parent's optimistic update immediately
    const newLikedState = !isLiked;
    onLikeToggle?.(id, newLikedState);

    try {
      await togglePostLike(id, isLiked);
    } catch (error) {
      console.error("Failed to toggle like:", error);
      // Rollback the optimistic update
      onLikeToggle?.(id, isLiked);
      toast({
        title: "Error",
        description: "Could not update like status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLiking(false);
    }
  };

  const handleComment = () => {
    setShowComments(!showComments);
  };

  const handleViewMedia = () => {
    setViewIndex(currentMediaIndex);
    setIsViewOpen(true);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Post deleted successfully",
      });

      if (onDelete) {
        onDelete(id);
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: "Error",
        description: "Failed to delete post",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteOpen(false);
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
          // Sync legacy fields
          media_url: editMediaItems.length > 0 ? editMediaItems[0].url : null,
          media_type: editMediaItems.length > 0 ? editMediaItems[0].type : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Post updated successfully",
      });
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

  // Helper to render media items
  const renderMediaGallery = () => {
    // Standardize to an array, checking both prop names just in case
    const items = Array.isArray(mediaItems) ? [...mediaItems] : [];

    // Fallback to legacy single media only if the new system didn't catch any items
    if (items.length === 0 && (hasImage || hasVideo)) {
      items.push({ url: mediaUrl || "", type: hasImage ? "image" : "video" });
    }

    if (items.length === 0) return null;

    // Single Item Layout
    if (items.length === 1) {
      const item = items[0];
      return (
        <div className="-mx-3 lg:-mx-4 w-[calc(100%+1.5rem)] lg:w-[calc(100%+2rem)] bg-black/5 sm:bg-black relative ring-1 ring-white/10 group-hover:ring-primary/20 transition-all duration-300 overflow-hidden h-auto sm:h-[400px] lg:h-[420px] flex items-center justify-center">
          {item.type === 'image' ? (
            <img
              src={getOptimizedImage(item.url, { width: 800, quality: 85 })}
              alt={imageAlt || "Post content"}
              className="w-full h-auto sm:h-full sm:object-contain object-cover block hover:scale-[1.01] transition-transform duration-700"
            />
          ) : (
            <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
              <video
                src={item.url}
                controls
                className="w-full h-auto sm:h-full sm:object-contain object-cover"
                preload="metadata"
              >
                Your browser does not support video playback.
              </video>
            </div>
          )}
          {isAIGenerated && (
            <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full z-10 shadow-lg">
              AI Generated
            </div>
          )}
        </div>
      );
    }

    // Carousel for multiple items
    return (
      <div 
        className="-mx-3 lg:-mx-4 w-[calc(100%+1.5rem)] lg:w-[calc(100%+2rem)] bg-black/5 sm:bg-black relative overflow-hidden group/carousel ring-1 ring-white/10"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => processSwipe(items.length, false)}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => processSwipe(items.length, false)}
        onMouseLeave={() => { if (touchStart !== null) processSwipe(items.length, false); }}
        onWheel={(e) => handleWheel(e, items.length, false)}
      >
        <div
          className="relative flex transition-transform duration-500 ease-out h-auto sm:h-[400px] lg:h-[420px] w-full"
          style={{ transform: `translateX(-${currentMediaIndex * 100}%)` }}
        >
          {items.map((item, idx) => (
            <div
              key={`${id}-carousel-${idx}`}
              className="w-full h-full flex-none"
            >
              {item.type === 'image' ? (
                <div className="w-full h-auto sm:h-full relative overflow-hidden flex items-center justify-center bg-black/5 sm:bg-black">
                  <img
                    src={getOptimizedImage(item.url, { width: 800, quality: 85 })}
                    alt={`Media ${idx + 1}`}
                    className="w-full h-auto sm:h-full sm:object-contain object-cover"
                  />
                </div>
              ) : (
                <div className="relative w-full h-auto sm:h-full bg-black/5 sm:bg-black flex items-center justify-center overflow-hidden">
                  <video
                    src={item.url}
                    className="w-full h-auto sm:h-full sm:object-contain object-cover"
                    muted
                    loop
                    onMouseOver={e => e.currentTarget.play()}
                    onMouseOut={e => e.currentTarget.pause()}
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-black/50 backdrop-blur-md p-2.5 rounded-full ring-1 ring-white/30">
                      <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Navigation Buttons */}
        <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2 opacity-0 group-hover/carousel:opacity-100 transition-opacity pointer-events-none">
          {currentMediaIndex > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 pointer-events-auto shadow-lg"
              onClick={(e) => { e.stopPropagation(); setCurrentMediaIndex(prev => prev - 1); }}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="flex-1" />
          {currentMediaIndex < items.length - 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 pointer-events-auto shadow-lg"
              onClick={(e) => { e.stopPropagation(); setCurrentMediaIndex(prev => prev + 1); }}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Dots Indicator */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 px-2 py-1 rounded-full bg-black/20 backdrop-blur-sm z-10">
          {items.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === currentMediaIndex ? 'bg-primary scale-125 w-3' : 'bg-white/40'}`}
            />
          ))}
        </div>

        {isAIGenerated && (
          <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full z-20 shadow-lg">
            AI Generated
          </div>
        )}
      </div>
    );
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
                {editMediaItems.map((item: { url: string, type: 'image' | 'video' }, idx: number) => (
                  <div key={idx} className="relative group/edit flex-shrink-0 w-24 aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-primary/50 transition-all duration-300">
                    {item.type === 'image' ? (
                      <img src={item.url} className="w-full h-full object-cover" alt="Edit thumbnail" />
                    ) : (
                      <div className="w-full h-full bg-black/40 flex items-center justify-center relative">
                        <Play className="w-6 h-6 text-white fill-white opacity-50" />
                        <video src={item.url} className="w-full h-full object-cover absolute inset-0 opacity-40" />
                      </div>
                    )}

                    {/* Delete button for individual media */}
                    <button
                      onClick={() => setEditMediaItems((prev: { url: string, type: 'image' | 'video' }[]) => prev.filter((_: any, i: number) => i !== idx))}
                      className="absolute top-1 right-1 h-6 w-6 bg-red-500 rounded-full flex items-center justify-center text-white p-1 shadow-lg transform translate-x-8 group-hover/edit:translate-x-0 transition-transform duration-300 hover:bg-black"
                    >
                      <X size={14} strokeWidth={3} />
                    </button>

                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors pointer-events-none" />
                  </div>
                ))}
                
                {/* Add Media Button */}
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

      <div className="relative overflow-hidden rounded-xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-card/30 backdrop-blur-md transition-all duration-300 hover:border-primary/50 group">
        <div className="relative">
          {/* Header - Padded */}
          <div className="flex items-center px-3 lg:px-4 py-2 lg:py-3">
            <Link
              to={pageInfo ? `/pages/${pageInfo.slug}` : (author.id ? `/profile/${author.id}` : '#')}
              className="hover:opacity-80 transition-opacity relative z-10"
            >
              <Avatar className={`h-8 w-8 lg:h-9 lg:w-9 mr-3 ring-2 ring-transparent group-hover:ring-primary/20 transition-all duration-300 ${pageInfo ? 'rounded-lg' : ''}`}>
                <AvatarImage src={getOptimizedImage(pageInfo ? (pageInfo.logo_url || "") : (author.avatar || ""), { width: 96, height: 96 }) || "/placeholder.svg"} className={pageInfo ? 'rounded-lg' : ''} />
                <AvatarFallback className={`bg-gradient-to-br from-primary to-secondary text-primary-foreground text-xs ${pageInfo ? 'rounded-lg' : ''}`}>
                  {pageInfo ? pageInfo.name.charAt(0) : author.initials}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="truncate">
                  {pageInfo ? (
                    <div className="flex items-center gap-1.5 truncate">
                      <Link to={`/pages/${pageInfo.slug}`} className="hover:text-primary transition-colors relative z-10 truncate">
                        <p className="font-semibold truncate text-[13px] lg:text-[14px]">{pageInfo.name}</p>
                      </Link>
                    </div>
                  ) : author.id ? (
                      <Link to={`/profile/${author.id}`} className="hover:text-primary transition-colors relative z-10 flex items-center gap-1.5 truncate">
                        <p className="font-semibold truncate text-[13px] lg:text-[14px]">{author.name}</p>
                        {author.isVerified && <VerificationBadge size="sm" />}
                        {['admin', 'moderator', 'super_admin'].includes(author.role?.toLowerCase() || '') && (
                          <StaffBadge role={author.role} showLabel={false} className="h-4 px-1" />
                        )}
                      </Link>
                  ) : (
                    <p className="font-semibold truncate text-[13px] lg:text-[14px]">{author.name}</p>
                  )}
                  <p className="text-[11px] lg:text-[12px] text-muted-foreground truncate">
                    {pageInfo ? "Company Page" : author.role} • {timeAgo}
                  </p>
                </div>

                <div className="flex-shrink-0 relative z-20">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-full transition-all">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-background/95 backdrop-blur-xl border-white/10 rounded-2xl shadow-xl">
                      {canManage ? (
                        <>
                          <DropdownMenuItem onClick={() => setIsEditOpen(true)} className="rounded-lg gap-2 cursor-pointer focus:bg-white/5">
                            <Edit className="h-4 w-4 text-primary" />
                            <span>Edit Post</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setIsDeleteOpen(true)} className="rounded-lg gap-2 cursor-pointer focus:bg-red-500/10 text-red-500 focus:text-red-500">
                            <Trash2 className="h-4 w-4" />
                            <span>Delete Post</span>
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <DropdownMenuItem onClick={() => setIsReportOpen(true)} className="rounded-lg gap-2 cursor-pointer focus:bg-rose-500/10 text-rose-500 focus:text-rose-500">
                          <Flag className="h-4 w-4" />
                          <span>Report Content</span>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <ReportDialog 
                    open={isReportOpen} 
                    onOpenChange={setIsReportOpen}
                    targetId={id}
                    targetType="post"
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Caption & Content - Now at the Top */}
          <div className="px-3 lg:px-4 py-2">
            <div className="space-y-2">
              <div className="text-[13px] lg:text-[14px] leading-relaxed">
                {content.includes('JOB_SHARE::') ? (
                  (() => {
                    try {
                      const parts = content.split('JOB_SHARE::');
                      const caption = parts[0].trim();
                      const jsonStr = parts[parts.length - 1].trim();
                      const shareData = JSON.parse(jsonStr);
                      return (
                        <div className="flex flex-col gap-3">
                            <div 
                              ref={contentRef}
                              className={cn(
                                "block",
                                !isExpanded && "line-clamp-3 overflow-hidden"
                              )}
                            >
                               {caption && <FormattedText text={caption} className="text-foreground/90" />}
                            </div>
                            {shouldShowMore && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsExpanded(!isExpanded);
                                }} 
                                className="text-primary text-[11px] lg:text-[12px] font-semibold hover:underline mt-1.5 block"
                              >
                                {isExpanded ? "see less" : "...more"}
                              </button>
                            )}
                          <div className="w-full">
                            <JobShareCard {...shareData} />
                          </div>
                        </div>
                      );
                    } catch (e) {
                      return (
                        <div className="block">
                          <div 
                            ref={contentRef}
                            className={cn(
                              "block text-foreground/90",
                              !isExpanded && "line-clamp-3 overflow-hidden"
                            )}
                          >
                            <FormattedText text={content} />
                          </div>
                          {shouldShowMore && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded(!isExpanded);
                              }} 
                              className="text-primary text-[11px] lg:text-[12px] font-semibold hover:underline mt-1.5 block"
                            >
                              {isExpanded ? "see less" : "...more"}
                            </button>
                          )}
                        </div>
                      );
                    }
                  })()
                ) : (
                  <div className="block">
                    <div 
                      ref={contentRef}
                      className={cn(
                        "block text-foreground/90",
                        !isExpanded && "line-clamp-3 overflow-hidden"
                      )}
                    >
                      <FormattedText text={content} />
                    </div>
                    {shouldShowMore && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsExpanded(!isExpanded);
                        }} 
                        className="text-primary text-[11px] lg:text-[12px] font-semibold hover:underline mt-1.5 block"
                      >
                        {isExpanded ? "see less" : "...more"}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {tags && tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {tags.map((tag) => (
                    <Link 
                      key={tag} 
                      to={`/search?q=${encodeURIComponent(tag)}`}
                      className="text-[11px] lg:text-[12px] font-semibold text-primary/80 hover:underline cursor-pointer bg-primary/5 px-2 py-0.5 rounded-full relative z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Media - Full width */}
          <div className="w-full bg-black/5" onClick={handleViewMedia}>
            {renderMediaGallery()}
          </div>

          {/* Footer actions and caption */}
          <div className="px-3 lg:px-4 py-2 lg:py-3">
            <div className="flex items-center justify-between mb-2 lg:mb-3">
              <div className="flex items-center gap-5">
                {!isInternal ? (
                  <button
                    onClick={handleLike}
                    disabled={isLiking}
                    className={`flex items-center gap-1.5 transition-all duration-300 group/like ${isLiked ? 'text-red-500' : 'text-foreground/80 hover:text-red-500'}`}
                  >
                    <div className="p-2 -m-2 rounded-full group-hover/like:bg-red-500/10 transition-colors">
                      <Heart size={24} className={`transition-transform duration-300 group-active/like:scale-125 ${isLiked ? 'fill-current' : ''}`} />
                    </div>
                    <span className="text-[13px] font-semibold">{displayLikeCount}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 text-foreground/50 cursor-not-allowed" title="Staff accounts cannot like posts">
                    <div className="p-2 -m-2 rounded-full">
                      <Heart size={24} />
                    </div>
                    <span className="text-[13px] font-semibold">{displayLikeCount}</span>
                  </div>
                )}
                
                <button
                  onClick={handleComment}
                  className="flex items-center gap-1.5 transition-all duration-300 group/comment text-foreground/80 hover:text-primary"
                >
                  <div className="p-2 -m-2 rounded-full group-hover/comment:bg-primary/10 transition-colors">
                    <MessageCircle size={24} />
                  </div>
                  <span className="text-[13px] font-semibold">{displayCommentCount}</span>
                </button>

                {!isInternal && <ShareButton postId={id} shareCount={share_count} />}
              </div>
              
              {!isInternal && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBookmark.mutate({ postId: id, isBookmarked });
                  }}
                  disabled={isTogglingBookmark}
                  className={`transition-all duration-300 ${isBookmarked ? 'text-primary' : 'text-foreground hover:text-muted-foreground'}`}
                >
                  <Bookmark size={22} className={isBookmarked ? 'fill-current' : ''} />
                </button>
              )}
            </div>

              <button onClick={handleComment} className="text-muted-foreground text-[13px] lg:text-sm hover:underline block pt-1">
                View all {displayCommentCount} comments
              </button>
            </div>
          </div>
        <AnimatePresence>
          {showComments && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden border-t border-white/5 bg-black/5"
            >
              <div className="p-3 sm:p-6 pt-2">
                <CommentSection postId={id} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Full-screen Media Viewer with Interaction Panel */}
        <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
          <DialogContent hideClose aria-describedby={undefined} className="max-w-7xl w-full h-full lg:w-[95vw] lg:h-[95vh] p-0 gap-0 bg-background border-none">
            <VisuallyHidden>
              <DialogTitle>Media Viewer for {author.name}'s Post</DialogTitle>
              <DialogDescription>
                Viewing images and interact with this post
              </DialogDescription>
            </VisuallyHidden>
            {(() => {
              const items = Array.isArray(mediaItems) && mediaItems.length > 0 ? mediaItems : (mediaUrl ? [{ url: mediaUrl, type: (hasImage ? 'image' : 'video') as 'image' | 'video' }] : []);
              const currentItem = items[viewIndex];
              const hasMultiple = items.length > 1;
              return (
                <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden">
                  {/* Mobile Author Header (Hidden on Desktop) */}
                  <div className="lg:hidden py-4 px-4 border-b border-border/10 bg-background/95 backdrop-blur-2xl flex items-center justify-between z-[60] shrink-0">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 ring-2 ring-foreground/5 shadow-xl">
                        <AvatarImage src={author.avatar || "/placeholder.svg"} />
                        <AvatarFallback className="bg-primary/10 text-primary font-black uppercase">
                          {author.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <p className="font-black text-sm md:text-base tracking-tight text-foreground">{author.name}</p>
                        <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-widest -mt-0.5">{author.craft || 'Artist'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground hover:bg-foreground/5 rounded-full">
                            <MoreVertical className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[180px] bg-card/95 backdrop-blur-xl border-border/10">
                          {user?.id === authorId || isAdmin ? (
                            <>
                              <DropdownMenuItem onClick={() => setIsEditOpen(true)} className="focus:bg-foreground/10 cursor-pointer py-2.5">
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Edit Post</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setIsDeleteOpen(true)} className="focus:bg-red-500/20 focus:text-red-500 text-red-500 cursor-pointer py-2.5">
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Delete Post</span>
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <>
                              <DropdownMenuItem className="focus:bg-foreground/10 cursor-pointer py-2.5">
                                <Share2 className="mr-2 h-4 w-4" />
                                <span>Share Link</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem className="focus:bg-red-500/20 focus:text-red-500 text-red-500 cursor-pointer py-2.5">
                                <Flag className="mr-2 h-4 w-4" />
                                <span>Report Post</span>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsViewOpen(false)}
                        className="h-8 w-8 text-foreground hover:bg-foreground/5 rounded-full"
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>

                  {/* Media Section: Left panel (Flexible) */}
                  <div
                    className="flex-1 bg-black flex items-center justify-center relative min-h-0 group/viewer overflow-hidden order-1 lg:order-none cursor-grab active:cursor-grabbing"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={() => processSwipe(items.length, true)}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={() => processSwipe(items.length, true)}
                    onMouseLeave={() => { if (touchStart !== null) processSwipe(items.length, true); }}
                    onWheel={(e) => handleWheel(e, items.length, true)}
                  >

                    {/* Multimedia Controls */}
                    {hasMultiple && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute left-2 lg:left-4 top-1/2 -translate-y-1/2 z-50 text-white bg-black/30 hover:bg-black/50 rounded-full opacity-100 lg:opacity-0 group-hover/viewer:opacity-100 transition-opacity h-10 w-10 lg:h-12 lg:w-12 backdrop-blur-sm"
                          onClick={(e) => { e.stopPropagation(); prevMedia(items.length); }}
                        >
                          <ChevronLeft className="h-6 w-6 lg:h-8 lg:w-8" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 lg:right-4 top-1/2 -translate-y-1/2 z-50 text-white bg-black/30 hover:bg-black/50 rounded-full opacity-100 lg:opacity-0 group-hover/viewer:opacity-100 transition-opacity h-10 w-10 lg:h-12 lg:w-12 backdrop-blur-sm"
                          onClick={(e) => { e.stopPropagation(); nextMedia(items.length); }}
                        >
                          <ChevronRight className="h-6 w-6 lg:h-8 lg:w-8" />
                        </Button>

                        {/* Dots (Instagram Style Overlaid) */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-1.5 px-2.5 py-1 rounded-full bg-black/20 backdrop-blur-[2px]">
                          {items.map((_, i) => (
                            <div
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === viewIndex ? 'bg-primary scale-125 w-3' : 'bg-white/40'}`}
                            />
                          ))}
                        </div>
                      </>
                    )}

                    {/* Display Media: Full width on mobile */}
                    <div className="h-full w-full flex items-center justify-center p-0 lg:p-8">
                      {currentItem?.type === 'video' ? (
                        <video
                          key={currentItem.url}
                          src={currentItem.url}
                          controls
                          autoPlay
                          className="w-full h-full lg:max-h-full lg:max-w-full object-contain shadow-2xl"
                        />
                      ) : (
                        <img
                          key={currentItem?.url}
                          src={currentItem?.url}
                          alt="Media in viewer"
                          className="w-full h-full lg:max-h-full lg:max-w-full object-contain shadow-2xl"
                        />
                      )}
                    </div>
                  </div>

                  {/* Interaction Panel: Right panel (Fixed width on desktop, dynamic on mobile) */}
                  <div className="w-full lg:w-[420px] flex flex-col bg-card border-l border-border/10 shrink-0 h-fit max-h-[45vh] lg:h-full lg:max-h-none overflow-hidden shadow-[-20px_0_40px_rgba(0,0,0,0.3)] order-2 lg:order-none z-10">
                    {/* Post Header (Desktop) */}
                    <div className="hidden lg:flex py-5 px-3 border-b border-border/10 items-center justify-between shrink-0 bg-background/95 backdrop-blur-3xl">
                      <div className="flex items-center gap-3 font-outfit">
                        <Avatar className="h-11 w-11 ring-2 ring-foreground/5 shadow-2xl">
                          <AvatarImage src={author.avatar || "/placeholder.svg"} />
                          <AvatarFallback className="bg-primary/10 text-primary font-black uppercase">{author.initials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <p className="font-black text-[15px] tracking-tight text-foreground leading-tight uppercase font-outfit">{author.name}</p>
                            {author.isVerified && <VerificationBadge size="xs" />}
                          </div>
                          <p className="text-[10px] text-foreground/40 font-black uppercase tracking-[0.25em] -mt-0.5">{author.craft || 'Artist'}</p>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground hover:bg-foreground/5 rounded-full">
                            <MoreVertical className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[180px] bg-card/95 backdrop-blur-xl border-border/10">
                          {user?.id === authorId || isAdmin ? (
                            <>
                              <DropdownMenuItem onClick={() => setIsEditOpen(true)} className="focus:bg-foreground/10 cursor-pointer py-2.5">
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Edit Post</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setIsDeleteOpen(true)} className="focus:bg-red-500/20 focus:text-red-500 text-red-500 cursor-pointer py-2.5">
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Delete Post</span>
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <>
                              <DropdownMenuItem className="focus:bg-foreground/10 cursor-pointer py-2.5">
                                <Share2 className="mr-2 h-4 w-4" />
                                <span>Share Link</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem className="focus:bg-red-500/20 focus:text-red-500 text-red-500 cursor-pointer py-2.5">
                                <Flag size={16} className="mr-2 h-4 w-4" />
                                <span>Report Post</span>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsViewOpen(false)}
                        className="h-8 w-8 text-foreground hover:bg-foreground/5 rounded-full ml-1"
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </div>

                    {/* Actions (Like, Comment, etc.) - ALWAYS AT TOP FOR MOBILE UNDER MEDIA, TOP OF RIGHT FOR DESKTOP */}
                    <div className="p-4 lg:p-5 border-b border-border/10 bg-background/50 backdrop-blur-2xl shrink-0 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                          <Button variant="ghost" size="icon" onClick={handleLike} disabled={isLiking} className="hover:scale-125 transition-transform hover:bg-transparent p-0 h-auto">
                            <Heart className={`h-7 w-7 transition-all duration-300 ${isLiked ? 'fill-red-500 text-red-500 scale-110' : 'hover:text-red-500'}`} />
                          </Button>
                          <Button variant="ghost" size="icon" className="hover:scale-125 transition-transform hover:bg-transparent p-0 h-auto">
                            <MessageCircle className="h-7 w-7 hover:text-primary transition-colors duration-300" />
                          </Button>
                          <Button variant="ghost" size="icon" className="hover:scale-125 transition-transform hover:bg-transparent p-0 h-auto">
                            <Share2 className="h-7 w-7 hover:text-primary transition-colors duration-300" />
                          </Button>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-black tracking-tight">{displayLikeCount} Likes</p>
                        </div>
                      </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6 custom-scrollbar scroll-smooth bg-background/30">
                      {content && (
                        <div className="flex gap-3.5 items-start">
                          <Avatar className="h-9 w-9 shrink-0 shadow-sm border border-white/10 ring-1 ring-primary/10">
                            <AvatarImage src={author.avatar || "/placeholder.svg"} />
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">{author.initials}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="text-[14px] leading-relaxed">
                              <span className="font-bold text-foreground mr-1.5 tracking-tight hover:underline cursor-pointer">
                                {author.name.toLowerCase().replace(/\s/g, '')}
                              </span>
                              <div className="block">
                                <div 
                                  ref={contentRef}
                                  className={cn(
                                    "block text-foreground/90 leading-relaxed",
                                    !isExpanded && "line-clamp-3 overflow-hidden"
                                  )}
                                >
                                  {content.includes('JOB_SHARE::') ? (
                                    (() => {
                                      try {
                                        const parts = content.split('JOB_SHARE::');
                                        const caption = parts[0].trim();
                                        return caption ? <FormattedText text={caption} /> : null;
                                      } catch (e) {
                                        return <FormattedText text={content} />;
                                      }
                                    })()
                                  ) : (
                                    <FormattedText text={content} />
                                  )}
                                </div>
                                {shouldShowMore && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setIsExpanded(!isExpanded);
                                    }} 
                                    className="text-primary text-[11px] font-semibold hover:underline mt-1 block"
                                  >
                                    {isExpanded ? "see less" : "...more"}
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground/60 mt-2.5 flex items-center gap-1.5 uppercase tracking-widest font-medium">
                              {timeAgo}
                              <span className="opacity-40 ml-1.5 cursor-pointer hover:text-foreground transition-colors font-bold tracking-widest text-[9px]">See translation</span>
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/40 px-1 border-b border-white/5 pb-2">Conversation Thread</h4>
                        <CommentSection postId={id} />
                      </div>
                    </div>

                    {/* Timestamp ONLY footer */}
                    <div className="p-3 border-t border-border/10 bg-background/90 backdrop-blur-2xl shrink-0 opacity-80">
                      <p className="text-[9px] text-muted-foreground/50 uppercase tracking-[0.4em] font-black text-center py-1">
                        PUBLISHED {new Date(createdAt || new Date()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </div>
              );

            })()}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default PostCard;
