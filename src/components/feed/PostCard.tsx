import { Heart, MessageCircle, Play, MoreVertical, Edit, Trash2, Loader2, X, ChevronLeft, ChevronRight, Share2, Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CommentSection from "./CommentSection";
import ShareButton from "../ShareButton";
import { useToast } from "@/hooks/use-toast";
import { togglePostLike } from "@/services/postService";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { usePostBookmarks } from "@/hooks/usePostBookmarks";
import { useRealtimePostStats } from "@/hooks/useRealtimePostStats";
import { FormattedText } from "@/components/ui/formatted-text";
import { JobShareCard } from "@/components/chat/JobShareCard";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
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
  const [editContent, setEditContent] = useState(content);
  const [editMediaItems, setEditMediaItems] = useState<{ url: string, type: 'image' | 'video' }[]>([]);

  // Real-time metrics
  const { likeCount: displayLikeCount, commentCount: displayCommentCount } = useRealtimePostStats(id, like_count, comment_count);

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

  const isOwner = user?.id === author.id || user?.id === authorId;

  // View States
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewIndex, setViewIndex] = useState(0);

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
        <div className="-mx-3 sm:-mx-6 mb-4 w-[calc(100%+1.5rem)] sm:w-[calc(100%+3rem)] bg-black/20 relative ring-1 ring-white/10 group-hover:ring-primary/20 transition-all duration-300 overflow-hidden">
          {item.type === 'image' ? (
            <img
              src={item.url}
              alt={imageAlt || "Post content"}
              className="w-full h-auto object-contain max-h-[600px] hover:scale-[1.01] transition-transform duration-1000"
            />
          ) : (
            <div className="relative aspect-video max-h-[600px] bg-black">
              <video
                src={item.url}
                controls
                className="w-full h-full object-contain"
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

    // Layout classes based on item count
    const gridCols = 'grid-cols-2';
    const gridRows = items.length === 2 ? 'grid-rows-1' : 'grid-rows-2';
    const containerHeight = items.length === 2 ? 'aspect-[16/10]' : 'aspect-square sm:aspect-auto sm:min-h-[400px]';

    const displayItems = items.slice(0, 4);
    const hasMore = items.length > 4;

    return (
      <div className={`-mx-3 sm:-mx-6 mb-4 w-[calc(100%+1.5rem)] sm:w-[calc(100%+3rem)] grid ${gridCols} ${gridRows} ${containerHeight} gap-0.5 bg-black/10 relative overflow-hidden ring-1 ring-white/10`}>
        {displayItems.map((item, idx) => {
          // If exactly 3 items, the first one should take the full height on the left
          const isFeatured = items.length === 3 && idx === 0;
          return (
            <div 
              key={`${id}-media-${idx}`} 
              onClick={(e) => { e.stopPropagation(); setViewIndex(idx); setIsViewOpen(true); }}
              className={`relative overflow-hidden group/media cursor-pointer border-[0.5px] border-white/5
                ${isFeatured ? 'row-span-2 h-full' : 'aspect-square h-full'}`}
            >
              {item.type === 'image' ? (
                <img
                  src={item.url}
                  alt={`Media ${idx + 1}`}
                  className="w-full h-full object-cover group-hover/media:scale-110 transition-transform duration-1000"
                />
              ) : (
                <div className="relative w-full h-full bg-black/40">
                  <video
                    src={item.url}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    onMouseOver={e => e.currentTarget.play()}
                    onMouseOut={e => e.currentTarget.pause()}
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform group-hover/media:scale-110 duration-500">
                    <div className="bg-black/50 backdrop-blur-md p-2.5 rounded-full ring-1 ring-white/30 shadow-2xl">
                      <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                    </div>
                  </div>
                </div>
              )}
              
              {idx === 3 && hasMore && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex flex-col items-center justify-center cursor-pointer hover:bg-black/60 transition-colors z-20">
                  <span className="text-3xl font-bold text-white tracking-tighter">+{items.length - 4}</span>
                  <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest mt-1">More</span>
                </div>
              )}
              
              {/* Overlay for hover state */}
              <div className="absolute inset-0 bg-primary/0 group-hover/media:bg-primary/5 transition-colors duration-500 pointer-events-none" />
            </div>
          );
        })}
        {isAIGenerated && (
          <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full z-30 shadow-lg">
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

            {/* Media editing UI */}
            {editMediaItems.length > 0 && (
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
                </div>
              </div>
            )}
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

    <div className="relative overflow-hidden rounded-xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-card/30 backdrop-blur-md transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_30px_-10px_rgba(var(--primary),0.3)] group">
      {/* Decorative gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="relative p-3 sm:p-6">
        <div className="flex items-center mb-4">
          <Link 
            to={pageInfo ? `/pages/${pageInfo.slug}` : (author.id ? `/profile/${author.id}` : '#')} 
            className="hover:opacity-80 transition-opacity relative z-10"
          >
            <Avatar className={`h-10 w-10 mr-3 ring-2 ring-transparent group-hover:ring-primary/20 transition-all duration-300 ${pageInfo ? 'rounded-lg' : ''}`}>
              <AvatarImage src={pageInfo ? (pageInfo.logo_url || "/placeholder.svg") : (author.avatar || "/placeholder.svg")} className={pageInfo ? 'rounded-lg' : ''} />
              <AvatarFallback className={`bg-gradient-to-br from-primary to-secondary text-primary-foreground ${pageInfo ? 'rounded-lg' : ''}`}>
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
                      <p className="font-semibold truncate">{pageInfo.name}</p>
                    </Link>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold border border-primary/20 scale-90">
                      PAGE
                    </span>
                  </div>
                ) : author.id ? (
                  <Link to={`/profile/${author.id}`} className="hover:text-primary transition-colors relative z-10 block truncate">
                    <p className="font-semibold truncate">{author.name}</p>
                  </Link>
                ) : (
                  <p className="font-semibold truncate">{author.name}</p>
                )}
                <p className="text-xs text-muted-foreground truncate">
                  {pageInfo ? "Company Page" : author.role} • {timeAgo}
                </p>
              </div>

              {isOwner && (
                <div className="flex-shrink-0 relative z-20">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-full transition-all">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-background/95 backdrop-blur-xl border-white/10 rounded-2xl shadow-xl">
                      <DropdownMenuItem onClick={() => setIsEditOpen(true)} className="rounded-lg gap-2 cursor-pointer focus:bg-white/5">
                        <Edit className="h-4 w-4 text-primary" />
                        <span>Edit Post</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setIsDeleteOpen(true)} className="rounded-lg gap-2 cursor-pointer focus:bg-red-500/10 text-red-500 focus:text-red-500">
                        <Trash2 className="h-4 w-4" />
                        <span>Delete Post</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </div>
        </div>

        {content.includes('JOB_SHARE::') ? (
          (() => {
            try {
              const parts = content.split('JOB_SHARE::');
              const caption = parts[0].trim();
              const jsonStr = parts[parts.length - 1].trim();
              const shareData = JSON.parse(jsonStr);
              return (
                <div className="mb-4 space-y-3">
                  {caption && <FormattedText text={caption} className="text-foreground/90 leading-relaxed" />}
                  <JobShareCard {...shareData} />
                </div>
              );
            } catch (e) {
              return <FormattedText text={content} className="mb-4 text-foreground/90 leading-relaxed" />;
            }
          })()
        ) : (
          <FormattedText text={content} className="mb-4 text-foreground/90 leading-relaxed" />
        )}

        {renderMediaGallery()}

        <div className="flex flex-wrap gap-2 mb-4 relative z-10">
          {tags && tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2.5 py-1 bg-primary/5 border border-primary/10 rounded-full text-primary/80 hover:bg-primary/10 hover:border-primary/30 cursor-pointer transition-all duration-300"
            >
              #{tag}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-white/5 relative z-10">
          <Button
            variant="ghost"
            size="sm"
            className={`text-muted-foreground hover:text-red-500 hover:bg-red-500/10 flex items-center gap-1.5 transition-all duration-300 ${isLiked ? 'text-red-500' : ''}`}
            onClick={handleLike}
            disabled={isLiking}
          >
            <Heart size={18} className={`transition-transform duration-300 ${isLiked ? 'fill-current scale-110' : 'group-hover:scale-110'}`} />
            <span>{displayLikeCount}</span>
          </Button>

          <Button variant="ghost" size="sm" className={`text-muted-foreground hover:text-primary hover:bg-primary/10 flex items-center gap-1.5 transition-all duration-300 ${showComments ? 'text-primary' : ''}`} onClick={handleComment}>
            <MessageCircle size={18} className={`transition-transform duration-300 ${showComments ? 'fill-current scale-110' : 'group-hover:scale-110'}`} />
            <span>{displayCommentCount}</span>
          </Button>

          <ShareButton postId={id} shareCount={share_count} />

          {/* Bookmark Button */}
          <Button
            variant="ghost"
            size="sm"
            className={`hover:bg-primary/10 group ${isBookmarked ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleBookmark.mutate({ postId: id, isBookmarked });
            }}
            disabled={isTogglingBookmark}
          >
            {isBookmarked ? (
              <BookmarkCheck className="h-5 w-5 fill-current" />
            ) : (
              <Bookmark className="h-5 w-5 group-hover:scale-110 transition-transform" />
            )}
            <VisuallyHidden>{isBookmarked ? 'Saved' : 'Save'}</VisuallyHidden>
          </Button>
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
        <DialogContent className="max-w-7xl w-full h-[95vh] lg:w-[95vw] lg:h-[95vh] p-0 gap-0 bg-black/95 backdrop-blur-xl border-none overflow-hidden rounded-3xl">
          <VisuallyHidden>
            <DialogTitle>Media Viewer for {author.name}'s Post</DialogTitle>
            <DialogDescription>
              Viewing images and interact with this post
            </DialogDescription>
          </VisuallyHidden>
          {(() => {
            const items = Array.isArray(mediaItems) && mediaItems.length > 0 ? mediaItems : (mediaUrl ? [{ url: mediaUrl, type: (hasImage ? 'image' : 'video') as 'image'|'video' }] : []);
            const currentItem = items[viewIndex];
            const hasMultiple = items.length > 1;
            return (
              <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden">
                {/* Mobile Author Header (Hidden on Desktop) */}
                <div className="lg:hidden p-4 border-b border-border/10 bg-background flex items-center justify-between z-50 shrink-0">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 ring-1 ring-primary/20">
                      <AvatarImage src={author.avatar || "/placeholder.svg"} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">{author.initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-sm tracking-tight">{author.name}</p>
                      <p className="text-[10px] text-muted-foreground italic -mt-0.5 opacity-80">{author.craft || 'Artist'}</p>
                    </div>
                  </div>
                  {/* Dialog Default Close will be in Top Right of DialogContent, 
                      but we keep this simple for layout balance if needed. 
                      Actually Radix Close is usually top right of DialogContent. */}
                </div>

                {/* Media Section: Left panel (Flexible) */}
                <div className="flex-1 bg-black flex items-center justify-center relative min-h-0 group/viewer overflow-hidden order-1 lg:order-none">
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
                  <div className="hidden lg:flex p-5 border-b border-border/10 items-center justify-between shrink-0 bg-background/50 backdrop-blur-xl">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-11 w-11 ring-2 ring-primary/20 shadow-md">
                        <AvatarImage src={author.avatar || "/placeholder.svg"} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">{author.initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-bold text-sm tracking-tight">{author.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-80">{author.craft || 'Artist'}</p>
                      </div>
                    </div>
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
                        <Avatar className="h-9 w-9 shrink-0 shadow-sm border border-white/10">
                          <AvatarImage src={author.avatar || "/placeholder.svg"} />
                          <AvatarFallback className="bg-primary/5 text-primary text-[10px]">{author.initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="bg-primary/5 rounded-3xl rounded-tl-none p-4 border border-primary/5 shadow-sm">
                            <div className="text-[14px] leading-relaxed">
                               <p className="font-black text-primary mb-1 tracking-tight">{author.name}</p>
                               {content.includes('JOB_SHARE::') ? (
                                  (() => {
                                    try {
                                      const parts = content.split('JOB_SHARE::');
                                      const caption = parts[0].trim();
                                      const jsonStr = parts[parts.length - 1].trim();
                                      const shareData = JSON.parse(jsonStr);
                                      return (
                                        <div className="space-y-3">
                                          {caption && <FormattedText text={caption} className="text-foreground/90 leading-relaxed" />}
                                          <div className="scale-90 origin-top-left">
                                            <JobShareCard {...shareData} />
                                          </div>
                                        </div>
                                      );
                                    } catch (e) {
                                      return <FormattedText text={content} className="text-foreground/90 leading-relaxed" />;
                                    }
                                  })()
                                ) : (
                                  <FormattedText text={content} className="text-foreground/90 leading-relaxed" />
                                )}
                            </div>
                          </div>
                          <p className="text-[9px] text-muted-foreground/60 mt-2.5 ml-1 flex items-center gap-1.5 uppercase tracking-widest font-black opacity-60">
                             • {timeAgo}
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
