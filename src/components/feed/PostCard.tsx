import { Heart, MessageCircle, Play, MoreVertical, Edit, Trash2, Loader2, X, ChevronLeft, ChevronRight, Bookmark, Flag, Plus, Pin, MapPin, User, Tag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ReportDialog from "../common/ReportDialog";
import VerificationBadge from "../common/VerificationBadge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAppNavigation } from "@/contexts/NavigationContext";
import { useState, useEffect, useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import CommentSection from "./CommentSection";
import ShareButton from "../ShareButton";
import { useToast } from "@/hooks/use-toast";
import { togglePostLike } from "@/services/postService";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { usePostBookmarks } from "@/hooks/usePostBookmarks";
import { useRealtimePostStats } from "@/hooks/useRealtimePostStats";
import { useAppRole } from "@/hooks/useAppRole";
import { useAccountType } from "@/hooks/useAccountType";
import { useFollows } from "@/hooks/useFollows";
import { useConnections } from "@/hooks/useConnections";
import { useFollowedPageIds, useToggleFollowPage } from "@/hooks/useCompanyPages";
import { useMediaQuery } from "@/hooks/use-media-query";
import { FormattedText } from "@/components/ui/formatted-text";
import { JobShareCard } from "@/components/chat/JobShareCard";
import { cn } from "@/lib/utils";
import { getOptimizedImage } from "@/utils/image-optimization";
import { StaffBadge } from "../internal/shared/StaffBadge";
import { CachedImage } from "@/components/common/CachedImage";
import { CachedVideo } from "@/components/common/CachedVideo";
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
  account_type?: string;
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
  mediaItems?: { url: string; type: "image" | "video"; crop?: any; zoom?: number; pan?: any; filter?: string; aspectRatio?: string }[];
  createdAt?: string;
  onDelete?: (postId: string) => void;
  pageInfo?: {
    id: string;
    name: string;
    logo_url: string | null;
    slug: string;
    is_verified?: boolean;
  };
  authorId?: string;
  location?: string | null;
  comments_disabled?: boolean;
  hide_likes?: boolean;
  tagged_users?: any[];
}

const LikeButton = ({ isLiked, isLiking, handleLike, likeCount, hideLikes }: { 
  isLiked: boolean; 
  isLiking: boolean; 
  handleLike: () => void; 
  likeCount: number; 
  hideLikes: boolean; 
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [isAnimating, setIsAnimating] = useState(false);

  // Trigger local animation state on click if it's a new like
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLiked && !isLiking) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 800);
    }
    handleLike();
  };

  const particles = Array.from({ length: 6 });

  return (
    <button
      onClick={handleClick}
      disabled={isLiking}
      className={`flex items-center gap-1.5 group/like focus:outline-none transition-colors ${
        isLiked ? 'text-primary' : 'text-foreground/80 hover:text-primary'
      }`}
    >
      <div className="relative p-2 -m-2 rounded-full group-hover/like:bg-primary/10 transition-colors flex items-center justify-center">
        {/* Expanding Ring */}
        <AnimatePresence>
          {isAnimating && !prefersReducedMotion && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0, borderWidth: "10px" }}
              animate={{ 
                scale: 1.5, 
                opacity: 0,
                borderWidth: "0px"
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="absolute inset-0 rounded-full border-primary box-border pointer-events-none"
            />
          )}
        </AnimatePresence>

        {/* Particles */}
        <AnimatePresence>
          {isAnimating && !prefersReducedMotion && particles.map((_, i) => (
            <motion.div
              key={i}
              initial={{ 
                scale: 0, 
                x: 0, 
                y: 0,
                opacity: 1
              }}
              animate={{ 
                scale: [0, 1, 0],
                x: Math.cos((i * 60) * (Math.PI / 180)) * 20,
                y: Math.sin((i * 60) * (Math.PI / 180)) * 20,
                opacity: [1, 1, 0]
              }}
              transition={{ 
                duration: 0.4, 
                ease: "easeOut",
                delay: 0.1 
              }}
              className="absolute w-1.5 h-1.5 rounded-full bg-primary pointer-events-none"
            />
          ))}
        </AnimatePresence>

        {/* Heart Icon */}
        <motion.div
          animate={
            prefersReducedMotion 
              ? { scale: 1 } 
              : isAnimating
                ? { 
                    scale: [1, 1.25, 0.95, 1],
                    rotate: [0, -6, 3, 0]
                  }
                : { scale: 1 }
          }
          transition={{ 
            duration: 0.26, 
            ease: [0.175, 0.885, 0.32, 1.275]
          }}
          whileTap={!prefersReducedMotion ? { scale: 0.85 } : {}}
          className="relative z-10 flex items-center justify-center"
        >
          <Heart 
            size={24} 
            className={`transition-colors duration-200 ${isLiked ? 'fill-primary text-primary drop-shadow-sm' : ''}`} 
          />
        </motion.div>
      </div>

      {/* Animated Like Count */}
      <div className={`overflow-hidden h-5 relative flex items-center ${hideLikes ? 'min-w-[3.5rem]' : 'min-w-[1.5rem]'}`}>
        <AnimatePresence mode="popLayout" initial={false}>
          {hideLikes ? (
            <motion.span
              key="hidden"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="text-[13px] font-semibold whitespace-nowrap"
            >
              {isLiked ? 'Liked' : 'Likes'}
            </motion.span>
          ) : (
            <motion.span
              key={likeCount}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="text-[13px] font-semibold absolute"
            >
              {likeCount}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </button>
  );
};

const PostCard = ({
  id,
  author,
  timeAgo,
  content: initialContent,
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
  mediaItems: initialMediaItems,
  createdAt,
  onDelete,
  pageInfo,
  authorId,
  location,
  comments_disabled,
  hide_likes,
  tagged_users
}: PostProps) => {

  const [content, setContent] = useState(initialContent);
  const [mediaItems, setMediaItems] = useState<{ url: string; type: "image" | "video"; crop?: any; zoom?: number; pan?: any; filter?: string; aspectRatio?: string }[] | undefined>(initialMediaItems);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  useEffect(() => {
    setMediaItems(initialMediaItems);
  }, [initialMediaItems]);

  const [showComments, setShowComments] = useState(false);
  const [showTaggedSheet, setShowTaggedSheet] = useState(false);
  const [taggedFollowStates, setTaggedFollowStates] = useState<Record<string, boolean>>({});
  // account_type keyed by user id, fetched when sheet opens
  const [taggedUserAccountTypes, setTaggedUserAccountTypes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!showTaggedSheet || taggedUsersList.length === 0) return;
    const ids = taggedUsersList.map((u: any) => u.id).filter(Boolean);
    if (ids.length === 0) return;
    supabase
      .from('profiles')
      .select('id, account_type')
      .in('id', ids)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string> = {};
        data.forEach((p: any) => { map[p.id] = p.account_type || 'fan'; });
        setTaggedUserAccountTypes(map);
      });
  }, [showTaggedSheet]);
  const firstMediaItem: any = (mediaItems && mediaItems[0]) || (initialMediaItems && initialMediaItems[0]) || {};
  const taggedUsersList: { id: string; username: string; full_name?: string; avatar_url?: string }[] =
    tagged_users || firstMediaItem?.tagged_users || [];
  const isCommentsDisabled = comments_disabled || !!firstMediaItem?.comments_disabled;
  const isHideLikes = hide_likes || !!firstMediaItem?.hide_likes;
  const [isLiking, setIsLiking] = useState(false);
  const [showFloatingHeart, setShowFloatingHeart] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { push } = useAppNavigation();
  const { isFan } = useAccountType();
  const { following, sendFollow, isSendingFollow } = useFollows();
  const { connections, sentRequests, pendingRequests, sendConnectionRequest } = useConnections();
  const { data: followedPageIds } = useFollowedPageIds();
  const toggleFollowPage = useToggleFollowPage();

  const isFollowRelationship = isFan || author.account_type === 'fan';
  const isFollowing = following?.some((f: any) => f.following_id === (author.id || authorId));
  const isConnected = connections?.some((c: any) => c.following_id === (author.id || authorId) || c.follower_id === (author.id || authorId)) ||
    sentRequests?.some((c: any) => c.following_id === (author.id || authorId)) ||
    pendingRequests?.some((c: any) => c.follower_id === (author.id || authorId));

  const isFollowingPage = pageInfo ? followedPageIds?.includes(pageInfo.id) : false;

  const shouldShowInlineAction = user &&
    (pageInfo ? !isFollowingPage : ((author.id || authorId) && user.id !== (author.id || authorId) && (isFollowRelationship ? !isFollowing : !isConnected)));

  const handleInlineAction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    if (pageInfo) {
      toggleFollowPage.mutate({ pageId: pageInfo.id, isFollowing: false });
    } else if (isFollowRelationship) {
      sendFollow(author.id || authorId || '');
    } else {
      try {
        await sendConnectionRequest(author.id || authorId || '');
      } catch (err: any) {
        // toast is handled by useConnections hook
      }
    }
  };

  const navigate = useNavigate();
  // Edit/Delete State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Bookmarks
  const { bookmarkedPostIds, toggleBookmark } = usePostBookmarks();
  const isBookmarked = Array.isArray(bookmarkedPostIds) && bookmarkedPostIds.includes(id);
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
      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
      let fileToUpload = file;

      if (mediaType === 'image') {
        const { compressImage } = await import('@/utils/imageCompression');
        fileToUpload = await compressImage(file);
      }

      const fileExt = fileToUpload.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}_${fileToUpload.name.replace(/[^a-zA-Z0-9.]/g, '_')}.${fileExt}`;
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

  // Real-time metrics
  const { likeCount: realtimeLikeCount, commentCount: displayCommentCount } = useRealtimePostStats(id, like_count, comment_count);
  const [optimisticLikeOffset, setOptimisticLikeOffset] = useState(0);

  // Reset offset when realtime count updates
  useEffect(() => {
    setOptimisticLikeOffset(0);
  }, [realtimeLikeCount]);

  const displayLikeCount = Math.max(0, realtimeLikeCount + optimisticLikeOffset);

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
      // In viewer (PostDialog) we don't handle swiping here anymore
      // But we still need this for inline if we use it
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
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 20) {
      if (wheelTimeout.current) return;
      if (e.deltaX > 0) {
        if (!isViewer && currentMediaIndex < max - 1) setCurrentMediaIndex(prev => prev + 1);
      } else {
        if (!isViewer && currentMediaIndex > 0) setCurrentMediaIndex(prev => prev - 1);
      }
      wheelTimeout.current = setTimeout(() => {
        wheelTimeout.current = null;
      }, 400);
    }
  };

  const isLiked = currentUserLiked || false;

  const handleLike = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Redirecting to sign in page...",
        variant: "destructive"
      });
      push(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (isLiking) return;

    setIsLiking(true);

    // Call the parent's optimistic update immediately
    const newLikedState = !isLiked;
    onLikeToggle?.(id, newLikedState);
    setOptimisticLikeOffset(prev => prev + (newLikedState ? 1 : -1));

    try {
      await togglePostLike(id, isLiked);
    } catch (error) {
      console.error("Failed to toggle like:", error);
      // Rollback the optimistic update and offset
      onLikeToggle?.(id, isLiked);
      setOptimisticLikeOffset(prev => prev - (newLikedState ? 1 : -1));
      toast({
        title: "Error",
        description: "Could not update like status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLiking(false);
    }
  };

  const handleMediaDoubleTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isLiking) {
      if (!isLiked) {
        setShowFloatingHeart(true);
        setTimeout(() => setShowFloatingHeart(false), 800);
      }
      handleLike();
    }
  };

  const handleComment = () => {
    setShowComments(!showComments);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // 1. Delete post record from Database
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // 2. Clean up uploaded photo/video media files from Supabase Storage
      const urlsToDelete: string[] = [];
      if (mediaUrl) urlsToDelete.push(mediaUrl);
      if (Array.isArray(mediaItems)) {
        mediaItems.forEach(item => {
          if (item?.url && !urlsToDelete.includes(item.url)) {
            urlsToDelete.push(item.url);
          }
        });
      }

      for (const url of urlsToDelete) {
        try {
          if (url.includes('/storage/v1/object/public/')) {
            const parts = url.split('/storage/v1/object/public/');
            if (parts[1]) {
              const bucketAndPath = parts[1];
              const bucketName = bucketAndPath.split('/')[0];
              const filePath = bucketAndPath.substring(bucketName.length + 1);
              if (bucketName && filePath) {
                await supabase.storage.from(bucketName).remove([decodeURIComponent(filePath)]);
              }
            }
          }
        } catch (storageErr) {
          console.warn("Could not remove media file from storage:", storageErr);
        }
      }

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
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      setContent(finalContent);
      setMediaItems(editMediaItems);

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

  // Helper to check if filter string has actual non-default edits
  const isFilterEdited = (filter?: string) => {
    if (!filter || filter === 'none') return false;
    // The default getFilterString output when no edits are made:
    // "brightness(100%) contrast(100%) saturate(100%) sepia(0%)"
    const normalized = filter.trim();
    if (normalized === 'brightness(100%) contrast(100%) saturate(100%) sepia(0%)') return false;
    return true;
  };

  // Helper to compute CSS styles from stored editing metadata
  const getMediaStyles = (item: { url: string; type: "image" | "video"; crop?: any; zoom?: number; pan?: any; filter?: string; aspectRatio?: string }) => {
    const styles: React.CSSProperties = {};
    const wrapperStyles: React.CSSProperties = {};

    // Apply filter (stored as a complete CSS filter string from the editor)
    if (isFilterEdited(item.filter)) {
      styles.filter = item.filter;
    }

    // Apply zoom and pan via transform
    const hasZoom = item.zoom !== undefined && item.zoom !== null && item.zoom !== 100;
    const panX = item.pan?.x || 0;
    const panY = item.pan?.y || 0;
    const hasPan = panX !== 0 || panY !== 0;
    if (hasZoom || hasPan) {
      const scaleVal = hasZoom ? (item.zoom! / 100) : 1;
      styles.transform = `translate(${panX}px, ${panY}px) scale(${scaleVal})`;
    }

    // Apply crop via clipPath
    const hasCrop = item.crop && (item.crop.top > 0 || item.crop.right > 0 || item.crop.bottom > 0 || item.crop.left > 0);
    if (hasCrop) {
      styles.clipPath = `inset(${item.crop.top || 0}% ${item.crop.right || 0}% ${item.crop.bottom || 0}% ${item.crop.left || 0}%)`;
    }

    // Apply aspect ratio on the wrapper container
    const hasAspectRatio = item.aspectRatio && item.aspectRatio !== 'original' && item.aspectRatio !== 'free';
    if (hasAspectRatio) {
      const ratioMap: Record<string, string> = {
        '1:1': '1/1',
        '4:5': '4/5',
        '16:9': '16/9',
      };
      if (ratioMap[item.aspectRatio!]) {
        wrapperStyles.aspectRatio = ratioMap[item.aspectRatio!];
      }
    }

    const hasAnyEdits = isFilterEdited(item.filter) || hasZoom || hasPan || hasCrop || hasAspectRatio;

    return { imageStyles: styles, wrapperStyles, hasAnyEdits, hasAspectRatio: !!hasAspectRatio };
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
      const { imageStyles, wrapperStyles, hasAnyEdits, hasAspectRatio } = getMediaStyles(item);
      return (
        <div 
          className="group/media -mx-3 lg:-mx-4 w-[calc(100%+1.5rem)] lg:w-[calc(100%+2rem)] relative ring-1 ring-white/10 group-hover:ring-primary/20 transition-all duration-300 overflow-hidden cursor-pointer select-none"
          style={hasAspectRatio ? wrapperStyles : undefined}
          onDoubleClick={handleMediaDoubleTap}
        >
          {item.type === 'image' ? (
            <CachedImage
              src={getOptimizedImage(item.url, { width: 800, quality: 85 })}
              alt={imageAlt || "Post content"}
              className={cn(
                "w-full block",
                hasAspectRatio ? 'h-full object-cover' : 'h-auto',
                !hasAnyEdits && 'hover:scale-[1.01] transition-transform duration-700'
              )}
              style={imageStyles}
            />
          ) : (
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              <CachedVideo
                src={item.url}
                controls
                className={cn(
                  "w-full block",
                  hasAspectRatio ? 'h-full object-cover' : 'h-auto'
                )}
                preload="metadata"
                style={imageStyles}
              >
                Your browser does not support video playback.
              </CachedVideo>
            </div>
          )}
          
          {/* Floating Heart for double tap */}
          <AnimatePresence>
            {showFloatingHeart && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0, rotate: -15 }}
                animate={{ scale: [0.5, 1.2, 1], opacity: [0, 1, 1], rotate: [-15, 0, 0] }}
                exit={{ scale: 0.8, opacity: 0, transition: { duration: 0.2 } }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-40"
              >
                <Heart className="w-24 h-24 text-white fill-white drop-shadow-2xl" />
              </motion.div>
            )}
          </AnimatePresence>

          {isAIGenerated && (
            <div className="font-mono absolute top-4 right-4 bg-black/70 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded z-10 shadow-lg">
              TYPE // AI GENERATED
            </div>
          )}

          {/* Person icon - opens Instagram-style bottom sheet */}
          {taggedUsersList.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowTaggedSheet(true);
              }}
              className="absolute bottom-3 left-5 z-30 p-2.5 rounded-full bg-black/70 hover:bg-black/90 backdrop-blur-md border border-white/25 text-white shadow-xl transition-all active:scale-90"
              title="See tagged people"
            >
              <User className="h-4 w-4 text-white" />
            </button>
          )}
        </div>
      );
    }

    // Carousel for multiple items
    return (
      <div
        className="-mx-3 lg:-mx-4 w-[calc(100%+1.5rem)] lg:w-[calc(100%+2rem)] bg-black/5 sm:bg-black relative overflow-hidden group/carousel ring-1 ring-white/10 cursor-pointer select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => processSwipe(items.length, false)}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => processSwipe(items.length, false)}
        onMouseLeave={() => { if (touchStart !== null) processSwipe(items.length, false); }}
        onWheel={(e) => handleWheel(e, items.length, false)}
        onDoubleClick={handleMediaDoubleTap}
      >
        <div
          className="relative flex transition-transform duration-500 ease-out h-auto w-full"
          style={{ transform: `translateX(-${currentMediaIndex * 100}%)` }}
        >
          {items.map((item, idx) => {
            const { imageStyles: carouselImageStyles, wrapperStyles: carouselWrapperStyles, hasAspectRatio } = getMediaStyles(item);
            return (
              <div
                key={`${id}-carousel-${idx}`}
                className="w-full flex-none overflow-hidden"
                style={hasAspectRatio ? carouselWrapperStyles : undefined}
              >
                {item.type === 'image' ? (
                  <CachedImage
                    src={getOptimizedImage(item.url, { width: 800, quality: 85 })}
                    alt={`Media ${idx + 1}`}
                    className={cn(
                      "w-full block",
                      hasAspectRatio ? 'h-full object-cover' : 'h-auto'
                    )}
                    style={carouselImageStyles}
                  />
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                    <CachedVideo
                      src={item.url}
                      className={cn(
                        "w-full block",
                        hasAspectRatio ? 'h-full object-cover' : 'h-auto'
                      )}
                      muted
                      loop
                      preload="metadata"
                      style={carouselImageStyles}
                      onMouseOver={(e: React.MouseEvent<HTMLVideoElement>) => e.currentTarget.play()}
                      onMouseOut={(e: React.MouseEvent<HTMLVideoElement>) => e.currentTarget.pause()}
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-black/50 backdrop-blur-md p-2.5 rounded-full ring-1 ring-white/30">
                        <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Floating Heart for double tap (carousel) */}
        <AnimatePresence>
          {showFloatingHeart && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotate: -15 }}
              animate={{ scale: [0.5, 1.2, 1], opacity: [0, 1, 1], rotate: [-15, 0, 0] }}
              exit={{ scale: 0.8, opacity: 0, transition: { duration: 0.2 } }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-40"
            >
              <Heart className="w-24 h-24 text-white fill-white drop-shadow-2xl" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2 opacity-0 group-hover/carousel:opacity-100 transition-opacity pointer-events-none z-20">
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

        {/* Person icon for carousel - opens bottom sheet */}
        {taggedUsersList.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowTaggedSheet(true);
            }}
            className="absolute bottom-3 left-5 z-30 p-2.5 rounded-full bg-black/70 hover:bg-black/90 backdrop-blur-md border border-white/25 text-white shadow-xl transition-all active:scale-90"
            title="See tagged people"
          >
            <User className="h-4 w-4 text-white" />
          </button>
        )}

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
                      <CachedImage src={item.url} className="w-full h-full object-cover" alt="Edit thumbnail" />
                    ) : (
                      <div className="w-full h-full bg-black/40 flex items-center justify-center relative">
                        <Play className="w-6 h-6 text-white fill-white opacity-50" />
                        <CachedVideo src={item.url} preload="none" className="w-full h-full object-cover absolute inset-0 opacity-40" />
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

      {/* ── "In this post" sheet — Dialog on desktop, bottom sheet on mobile ── */}
      {showTaggedSheet && taggedUsersList.length > 0 && (() => {
        const isDesktop = window.innerWidth >= 768;

        // Shared user rows content
        const userRows = (
          <div className="divide-y divide-border/40">
            {taggedUsersList.map((u: any, idx: number) => {
              const isActioned = taggedFollowStates[u.id] ?? false;
              const isMe = user?.id === u.id;
              // Match the app's follow/connect logic:
              // Follow = viewer is fan OR tagged user is a fan
              // Connect = both are professionals (creator/studio)
              const taggedAccountType = taggedUserAccountTypes[u.id] || 'fan'; // default fan = Follow
              const isFollowRelationshipForTagged = isFan || taggedAccountType === 'fan';
              const actionLabel = isFollowRelationshipForTagged ? 'Follow' : 'Connect';
              const actionedLabel = isFollowRelationshipForTagged ? 'Following' : 'Connected';
              return (
                <div key={idx} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                  <button onClick={() => { setShowTaggedSheet(false); push(`/profile/${u.id || u.username}`); }} className="shrink-0">
                    <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                      <AvatarImage src={u.avatar_url || ''} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground text-sm font-bold">
                        {(u.full_name || u.username || '?').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                  <button onClick={() => { setShowTaggedSheet(false); push(`/profile/${u.id || u.username}`); }} className="flex-1 text-left min-w-0">
                    <p className="text-foreground font-semibold text-sm leading-tight truncate">{u.username || u.full_name}</p>
                    {u.full_name && u.full_name !== u.username && (
                      <p className="text-muted-foreground text-xs truncate">{u.full_name}</p>
                    )}
                  </button>
                  {!isMe && (
                    <button
                      onClick={() => {
                        setTaggedFollowStates(prev => ({ ...prev, [u.id]: !isActioned }));
                        if (!isActioned) {
                          if (isFollowRelationshipForTagged) { sendFollow(u.id); }
                          else { try { sendConnectionRequest(u.id); } catch (_) {} }
                        }
                      }}
                      className={`shrink-0 text-xs font-bold px-4 py-1.5 rounded-lg transition-all border ${
                        isActioned
                          ? 'bg-muted text-muted-foreground border-border'
                          : 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
                      }`}
                    >
                      {isActioned ? actionedLabel : actionLabel}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        );

        if (isDesktop) {
          // ── Desktop: compact centered Dialog matching share sheet style ──
          return (
            <Dialog open={showTaggedSheet} onOpenChange={setShowTaggedSheet}>
              <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden rounded-2xl bg-background border border-border shadow-2xl gap-0">
                <DialogHeader className="px-5 pt-4 pb-3 border-b border-border/60">
                  <DialogTitle className="text-sm font-bold text-foreground tracking-tight">In this post</DialogTitle>
                  <DialogDescription className="sr-only">People tagged in this post</DialogDescription>
                </DialogHeader>
                <div className="overflow-y-auto max-h-[360px]">
                  {userRows}
                </div>
                <div className="h-2" />
              </DialogContent>
            </Dialog>
          );
        }

        // ── Mobile: compact bottom sheet ──
        return (
          <div className="fixed inset-0 z-[999] flex flex-col justify-end" onClick={() => setShowTaggedSheet(false)}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-150" />
            <div className="relative bg-background border-t border-border rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom-8 duration-250 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="w-8 h-1 bg-muted-foreground/30 rounded-full mx-auto mt-2.5 mb-1" />
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
                <h3 className="text-foreground font-bold text-sm tracking-tight">In this post</h3>
                <button onClick={() => setShowTaggedSheet(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[50vh] overflow-y-auto">
                {userRows}
              </div>
              <div className="h-4" />
            </div>
          </div>
        );
      })()}

      <div className="relative overflow-hidden bg-transparent border-none shadow-none group">
        <div className="relative">
          {/* Header - Padded */}
          <div className="flex items-center px-3 lg:px-4 py-2 lg:py-3">
            <div
              onClick={() => {
                const path = pageInfo ? `/pages/${pageInfo.slug}` : (author.id ? `/profile/${author.id}` : '#');
                if (path !== '#') push(path);
              }}
              className="hover:opacity-80 transition-opacity relative z-10 cursor-pointer"
            >
              <Avatar className={`h-8 w-8 lg:h-9 lg:w-9 mr-3 ring-2 ring-transparent group-hover:ring-primary/20 transition-all duration-300 ${pageInfo ? 'rounded-lg' : ''}`}>
                <AvatarImage src={getOptimizedImage(pageInfo ? (pageInfo.logo_url || "") : (author.avatar || ""), { width: 96, height: 96 }) || undefined} className={pageInfo ? 'rounded-lg' : ''} />
                <AvatarFallback className={`bg-gradient-to-br from-primary to-secondary text-primary-foreground text-xs ${pageInfo ? 'rounded-lg' : ''}`}>
                  {pageInfo ? pageInfo.name.charAt(0).toUpperCase() : (author.initials || author.name?.slice(0, 2).toUpperCase() || '??')}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="truncate">
                  {pageInfo ? (
                    <div className="flex items-center gap-1.5 truncate">
                      <div onClick={() => push(`/pages/${pageInfo.slug}`)} className="hover:text-primary transition-colors relative z-10 flex items-center gap-1.5 truncate cursor-pointer">
                        <p className="font-serif font-bold truncate text-[10px] lg:text-[11px] uppercase tracking-tight">{pageInfo.name}</p>
                        {pageInfo.is_verified && <VerificationBadge size="sm" />}
                        {shouldShowInlineAction && (
                          <>
                            <span className="text-muted-foreground/50 mx-0.5">•</span>
                            <button
                              onClick={handleInlineAction}
                              disabled={toggleFollowPage.isPending}
                              className="text-primary hover:text-primary/80 font-bold text-[12px] lg:text-[13px] transition-colors focus:outline-none"
                            >
                              Follow
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ) : author.id ? (
                    <div onClick={() => push(`/profile/${author.id}`)} className="hover:text-primary transition-colors relative z-10 flex items-center gap-1.5 truncate cursor-pointer group/name">
                      <p className="font-serif font-bold truncate text-[10px] lg:text-[11px] uppercase tracking-tight">{author.name}</p>
                      {author.isVerified && <VerificationBadge size="sm" />}
                      {['admin', 'moderator', 'super_admin'].includes(author.role?.toLowerCase() || '') && (
                        <StaffBadge role={author.role} showLabel={false} className="h-4 px-1" />
                      )}
                      {shouldShowInlineAction && (
                        <>
                          <span className="text-muted-foreground/50 mx-0.5">•</span>
                          <button
                            onClick={handleInlineAction}
                            disabled={isSendingFollow}
                            className="text-primary hover:text-primary/80 font-bold text-[12px] lg:text-[13px] transition-colors focus:outline-none"
                          >
                            {isFollowRelationship ? 'Follow' : 'Connect'}
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="font-serif font-bold truncate text-[10px] lg:text-[11px] uppercase tracking-tight">{author.name}</p>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <p className="text-[8px] text-muted-foreground truncate uppercase tracking-widest font-mono font-bold opacity-80">
                      {pageInfo ? "Company Page" : author.role} • {timeAgo}
                    </p>
                    {(() => {
                      const displayLoc = location || (mediaItems && (mediaItems[0] as any)?.location);
                      if (!displayLoc) return null;
                      return (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            push(`/search?q=${encodeURIComponent(displayLoc)}`);
                          }}
                          className="text-[9px] font-bold text-primary hover:underline flex items-center gap-0.5 transition-all cursor-pointer relative z-10"
                        >
                          <MapPin className="h-2.5 w-2.5 shrink-0" />
                          <span>{displayLoc}</span>
                        </button>
                      );
                    })()}
                  </div>
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
                          <DropdownMenuItem onClick={() => navigate(`/create?editPostId=${id}`)} className="rounded-lg gap-2 cursor-pointer focus:bg-white/5">
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
              <div className="text-[11px] lg:text-[12px] leading-relaxed">
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
                            <JobShareCard {...shareData} compact={true} className="w-full max-w-[450px]" />
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
                    <div
                      key={tag}
                      onClick={(e) => {
                        e.stopPropagation();
                        push(`/search?q=${encodeURIComponent(tag)}`);
                      }}
                      className="text-[11px] lg:text-[12px] font-semibold text-primary/80 hover:underline cursor-pointer bg-primary/5 px-2 py-0.5 rounded-full relative z-10"
                    >
                      #{tag}
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>

          {/* Media - Full width */}
          <div className="w-full">
            {renderMediaGallery()}
          </div>

          {/* Footer actions and caption */}
          <div className="px-3 lg:px-4 py-2 lg:py-3">
            <div className="flex items-center justify-between mb-2 lg:mb-3">
              <div className="flex items-center gap-5">
                {!isInternal ? (
                  <LikeButton 
                    isLiked={isLiked} 
                    isLiking={isLiking} 
                    handleLike={handleLike} 
                    likeCount={displayLikeCount} 
                    hideLikes={isHideLikes}
                  />
                ) : (
                  <div className="flex items-center gap-1.5 text-foreground/50 cursor-not-allowed" title="Staff accounts cannot like posts">
                    <div className="p-2 -m-2 rounded-full">
                      <Heart size={24} />
                    </div>
                    <span className="text-[13px] font-semibold">
                      {isHideLikes ? (isLiked ? 'Liked' : 'Likes') : displayLikeCount}
                    </span>
                  </div>
                )}

                {isCommentsDisabled ? (
                  <div className="flex items-center gap-1.5 text-muted-foreground/60 cursor-not-allowed text-xs font-semibold" title="Comments turned off">
                    <MessageCircle size={24} className="opacity-40" />
                    <span className="text-[11px] italic">Off</span>
                  </div>
                ) : (
                  <button
                    onClick={handleComment}
                    className="flex items-center gap-1.5 transition-all duration-300 group/comment text-foreground/80 hover:text-primary"
                  >
                    <div className="p-2 -m-2 rounded-full group-hover/comment:bg-primary/10 transition-colors">
                      <MessageCircle size={24} />
                    </div>
                    <span className="text-[13px] font-semibold">{displayCommentCount}</span>
                  </button>
                )}

                {!isInternal && (
                  <ShareButton
                    postId={id}
                    shareCount={share_count}
                    previewUrl={mediaUrl || (mediaItems && mediaItems[0]?.url)}
                    caption={content}
                    author={{
                      username: author.name,
                      avatar_url: author.avatar || null,
                      is_verified: author.isVerified
                    }}
                  />
                )}
              </div>

              {!isInternal && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!user) {
                      toast({
                        title: "Sign in required",
                        description: "Redirecting to sign in page...",
                        variant: "destructive"
                      });
                      push(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`);
                      return;
                    }
                    toggleBookmark.mutate({ postId: id, isBookmarked });
                  }}
                  disabled={isTogglingBookmark}
                  className={`transition-all duration-300 ${isBookmarked ? 'text-primary' : 'text-foreground hover:text-muted-foreground'}`}
                >
                  <Bookmark size={22} className={isBookmarked ? 'fill-current' : ''} />
                </button>
              )}
            </div>

            {isCommentsDisabled ? (
              <p className="text-muted-foreground text-xs italic pt-1 font-medium">Comments are turned off for this post.</p>
            ) : displayCommentCount > 0 ? (
              <button onClick={handleComment} className="text-muted-foreground text-[13px] lg:text-sm hover:underline block pt-1">
                View all {displayCommentCount} {displayCommentCount === 1 ? 'comment' : 'comments'}
              </button>
            ) : null}
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
                {isCommentsDisabled ? (
                  <p className="text-center text-xs text-muted-foreground italic py-3">Comments are turned off for this post.</p>
                ) : (
                  <CommentSection postId={id} />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </>
  );
};

export default PostCard;
