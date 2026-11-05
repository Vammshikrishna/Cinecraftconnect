import { Heart, MessageCircle, Play, MoreVertical, Edit, Trash2, Loader2, X, ChevronLeft, ChevronRight, Bookmark, Flag, Plus, Pin, MapPin, User, Tag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ReportDialog from "../common/ReportDialog";
import VerificationBadge from "../common/VerificationBadge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAppNavigation } from "@/contexts/NavigationContext";
import { useState, useEffect, useRef, lazy, Suspense } from "react";
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
import { FeedVideo } from "@/components/common/FeedVideo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { extractHashtags, friendlyError, mediaItemRatio } from '@cinecraft/core';
import { PostPoll } from './PostPoll';
import { ScheduledBanner, CollaboratorsLine, LinkPreviewCard } from './PostExtras';
import type { LinkPreview } from '@cinecraft/core';
import { PostInsightsDialog } from './PostInsightsDialog';
import { hidePost, unhidePost, muteAuthor, unmuteAuthor, removeMutedWord, blockUser, postLink, addMutedWord, feedReasonText } from '@cinecraft/core';
// the full-screen viewer is only needed when someone taps a picture, so it loads on demand
const ImageLightboxModal = lazy(() => import("@/components/chat/ImageLightboxModal"));

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
  mediaItems?: { url: string; type: "image" | "video"; crop?: any; zoom?: number; pan?: any; filter?: string; filterName?: string; adjustments?: any; text_overlays?: any[]; aspectRatio?: string }[];
  createdAt?: string;
  onDelete?: (postId: string) => void;
  /** the post (or everything by its author) was hidden from my feed */
  onHidden?: (postId: string, authorId: string | null, scope: 'post' | 'author') => void;
  /** why this post is in my feed (sent by the database) */
  feedReason?: string | null;
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
  /** public (default), connections or private: shown as a small label so the author remembers who can see it */
  audience?: string | null;
  /** this post has a poll: it is loaded and shown under the text */
  has_poll?: boolean;
  /** when the post goes live (only the author sees a post before that) */
  scheduled_at?: string | null;
  /** the post credits collaborators: they are loaded and shown under the text */
  has_collabs?: boolean;
  /** title, description and picture of the first link */
  link_preview?: LinkPreview | null;
  /** set when the caption or media was changed after posting */
  edited_at?: string | null;
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
      aria-label={isLiked ? 'Unlike' : 'Like'}
      aria-pressed={isLiked}
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
      <div className={`overflow-hidden h-5 relative flex items-center ${hideLikes ? 'min-w-[3.5rem]' : 'min-w-[3ch]'}`}>
        <AnimatePresence mode="popLayout" initial={false}>
          {hideLikes ? (
            <motion.span
              key="hidden"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="text-sm font-semibold whitespace-nowrap"
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
              className="text-sm font-semibold absolute"
            >
              {new Intl.NumberFormat(undefined, { notation: 'compact' }).format(likeCount || 0)}
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
  audience,
  edited_at,
  has_poll,
  scheduled_at,
  has_collabs,
  link_preview,
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
  onHidden,
  feedReason,
  pageInfo,
  authorId,
  location,
  comments_disabled,
  hide_likes,
  tagged_users
}: PostProps) => {

  const [content, setContent] = useState(initialContent);
  const [mediaItems, setMediaItems] = useState<{ url: string; type: "image" | "video"; crop?: any; zoom?: number; pan?: any; filter?: string; filterName?: string; adjustments?: any; text_overlays?: any[]; aspectRatio?: string }[] | undefined>(initialMediaItems);

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
        description: friendlyError(error, "Failed to upload file"),
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
      if (items.length === 0 && mediaUrl && (hasImage || hasVideo)) {
        items.push({ url: mediaUrl || "", type: hasImage ? "image" : "video" });
      }
      setEditMediaItems(items);
    }
  }, [isEditOpen, content, mediaItems, hasImage, hasVideo, mediaUrl]);

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [hiddenLocal, setHiddenLocal] = useState(false);

  const targetAuthorId: string | null = author.id || authorId || null;
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(postLink(id, window.location.origin)); toast({ title: 'Link copied' }); }
    catch { toast({ title: 'Could not copy the link', variant: 'destructive' }); }
  };
  // The card goes away at once. The feed forgets it a few seconds later, so Undo can still bring it back.
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(hideTimer.current), []);
  const hideWithUndo = (scope: 'post' | 'author', title: string, description: string, undo: () => Promise<void>) => {
    setHiddenLocal(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => onHidden?.(id, targetAuthorId, scope), 8000);
    toast.undo(title, async () => {
      clearTimeout(hideTimer.current);
      try {
        await undo();
        setHiddenLocal(false);
      } catch (e: any) {
        toast({ title: 'Could not undo that', description: friendlyError(e), variant: 'destructive' });
        onHidden?.(id, targetAuthorId, scope);
      }
    }, description);
  };
  const notInterested = async () => {
    if (!user) return;
    try {
      await hidePost(supabase, user.id, id);
      hideWithUndo('post', 'Post hidden', "We'll show fewer posts like this.", () => unhidePost(supabase, user.id, id));
    } catch (e: any) { toast({ title: 'Could not hide the post', description: friendlyError(e), variant: 'destructive' }); }
  };
  const muteTopic = async (tag: string) => {
    if (!user) return;
    try {
      const word = await addMutedWord(supabase, user.id, tag);
      hideWithUndo('post', `Muted "${word}"`, 'Posts with it will not show in your feed.', () => removeMutedWord(supabase, user.id, word));
    } catch (e: any) { toast({ title: 'Could not mute', description: friendlyError(e), variant: 'destructive' }); }
  };
  const muteThisAuthor = async () => {
    if (!user || !targetAuthorId) return;
    try {
      await muteAuthor(supabase, user.id, targetAuthorId);
      hideWithUndo('author', `Muted ${author.name}`, 'Their posts will not show in your feed.', () => unmuteAuthor(supabase, user.id, targetAuthorId));
    } catch (e: any) { toast({ title: 'Could not mute', description: friendlyError(e), variant: 'destructive' }); }
  };
  const blockThisAuthor = async () => {
    if (!user || !targetAuthorId) return;
    try {
      await blockUser(supabase, user.id, targetAuthorId);
      hideWithUndo('author', `Blocked ${author.name}`, 'They can no longer message you. Undo to unblock.', async () => {
        const { error } = await (supabase as any).from('blocked_users').delete().eq('user_id', user.id).eq('blocked_user_id', targetAuthorId);
        if (error) throw error;
      });
    } catch (e: any) { toast({ title: 'Could not block', description: friendlyError(e), variant: 'destructive' }); }
  };

  const { isAdmin, isInternal } = useAppRole();
  const isOwner = user?.id === author.id || user?.id === authorId;
  const canManage = isOwner || isAdmin;

  // View States
  const [viewIndex, setViewIndex] = useState(0);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  // full-screen picture viewer: null = closed, otherwise the index (among this post's pictures) to open at
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const viewerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressX = useRef(0);
  // Carousel drag lives in refs: the track follows the finger 1:1 without re-rendering this big component on every move.
  const dragStartRef = useRef<number | null>(null);
  const dragEndRef = useRef<number | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const wheelTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const settleTrack = (index: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = '';
    el.style.transform = `translateX(-${index * 100}%)`;
  };

  // Common handler for touch and mouse ends
  const processSwipe = (max: number, isViewer: boolean) => {
    const start = dragStartRef.current;
    const end = dragEndRef.current;
    dragStartRef.current = null;
    dragEndRef.current = null;
    let next = currentMediaIndex;
    if (start !== null && end !== null && !isViewer) {
      const distance = start - end;
      if (distance > 50 && currentMediaIndex < max - 1) next = currentMediaIndex + 1;
      if (distance < -50 && currentMediaIndex > 0) next = currentMediaIndex - 1;
    }
    settleTrack(next);
    if (next !== currentMediaIndex) setCurrentMediaIndex(next);
  };

  const dragTo = (x: number, max: number) => {
    const start = dragStartRef.current;
    const el = trackRef.current;
    if (start === null) return;
    dragEndRef.current = x;
    if (!el) return;
    let dx = x - start;
    // rubber-band at the first and last slide
    if ((currentMediaIndex === 0 && dx > 0) || (currentMediaIndex === max - 1 && dx < 0)) dx *= 0.3;
    el.style.transition = 'none';
    el.style.transform = `translateX(calc(-${currentMediaIndex * 100}% + ${dx}px))`;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    pressX.current = e.targetTouches[0].clientX;
    dragEndRef.current = null;
    dragStartRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent, max: number) => {
    dragTo(e.targetTouches[0].clientX, max);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    pressX.current = e.clientX;
    dragEndRef.current = null;
    dragStartRef.current = e.clientX;
  };

  const handleMouseMove = (e: React.MouseEvent, max: number) => {
    if (dragStartRef.current !== null) dragTo(e.clientX, max);
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

  // A tap on a picture opens the viewer. It waits a moment so a double tap (like) does not also open it, and a swipe never counts as a tap.
  const openViewerOnTap = (imageIndex: number, e: React.MouseEvent) => {
    if (Math.abs(e.clientX - pressX.current) > 8) return;
    if (viewerTimer.current) clearTimeout(viewerTimer.current);
    viewerTimer.current = setTimeout(() => setViewerIndex(imageIndex), 260);
  };
  // pictures can be looked at, not opened as a bare storage address or dragged out of the page
  const guardImage = {
    draggable: false as const,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onDragStart: (e: React.DragEvent) => e.preventDefault(),
  };

  const handleMediaDoubleTap = (e: React.MouseEvent) => {
    if (viewerTimer.current) { clearTimeout(viewerTimer.current); viewerTimer.current = null; }
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
          tags: extractHashtags(finalContent),
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
  const getMediaStyles = (item: { url: string; type: "image" | "video"; crop?: any; zoom?: number; pan?: any; filter?: string; filterName?: string; adjustments?: any; text_overlays?: any[]; aspectRatio?: string }) => {
    const styles: React.CSSProperties = {};
    const wrapperStyles: React.CSSProperties = {};

    // Filters, colour changes and text are already part of the saved picture (posts since the new editor have nothing
    // else saved with them). Older posts also carry a filter name from when the picture was edited before saving, and
    // replaying it would apply the filter a second time, so it is not replayed. Only the old crop/zoom/pan of posts
    // made before the new editor is still replayed below, because those were never saved into the picture.

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

    const hasAnyEdits = hasZoom || hasPan || hasCrop || hasAspectRatio;

    return { imageStyles: styles, wrapperStyles, hasAnyEdits, hasAspectRatio: !!hasAspectRatio };
  };

  // The pictures of this post, larger than the feed copies, for the full-screen viewer (same item rules as the gallery below)
  const viewerImages = (() => {
    const list: any[] = (Array.isArray(mediaItems) ? [...mediaItems] : []).filter((i: any) => i && i.url);
    if (list.length === 0 && mediaUrl && hasImage) list.push({ url: mediaUrl, type: 'image' });
    return list.filter((i) => i.type === 'image').map((i) => getOptimizedImage(i.url, { width: 1600, quality: 90 }));
  })();

  // Helper to render media items
  const renderMediaGallery = () => {
    // Standardize to an array, checking both prop names just in case
    // details-only items (no url) are not media: skip them
    const items = (Array.isArray(mediaItems) ? [...mediaItems] : []).filter((i: any) => i && i.url);

    // Fallback to legacy single media only if the new system didn't catch any items
    if (items.length === 0 && mediaUrl && (hasImage || hasVideo)) {
      items.push({ url: mediaUrl || "", type: hasImage ? "image" : "video" });
    }

    if (items.length === 0) return null;

    // Single Item Layout
    if (items.length === 1) {
      const item = items[0];
      return (
        <div 
          className="group/media [container-type:inline-size] bg-black w-full relative ring-1 ring-foreground/10 group-hover:ring-primary/20 transition duration-300 overflow-hidden cursor-pointer select-none"
          onDoubleClick={handleMediaDoubleTap}
        >
          {item.type === 'image' ? (
            <CachedImage
              src={getOptimizedImage(item.url, { width: 800, quality: 85 })}
              alt={(item as any).alt || imageAlt || "Post content"}
              className="w-full block h-auto max-h-[125cqw] object-cover hover:scale-[1.01] transition-transform duration-700 select-none [-webkit-user-drag:none] [-webkit-touch-callout:none]"
              style={mediaItemRatio(item) ? { aspectRatio: String(mediaItemRatio(item)) } : undefined}
              role="button"
              tabIndex={0}
              aria-label="Open picture"
              onClick={(e) => openViewerOnTap(0, e)}
              onKeyDown={(e) => { if (e.key === 'Enter') setViewerIndex(0); }}
              {...guardImage}
            />
          ) : (
            <FeedVideo src={item.url} delayClick aspectHint={mediaItemRatio(item)} />
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
            <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-md border border-white/20 text-white text-[12px] font-medium px-3 py-1.5 rounded z-10 shadow-lg">
              AI generated
            </div>
          )}

          {/* Person icon - opens Instagram-style bottom sheet */}
          {taggedUsersList.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowTaggedSheet(true);
              }}
              className="absolute bottom-3 left-5 z-30 p-2.5 rounded-full bg-black/70 hover:bg-black/90 backdrop-blur-md border border-white/25 text-white shadow-xl transition active:scale-90"
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
        className="w-full bg-black/5 sm:bg-black relative overflow-hidden group/carousel ring-1 ring-white/10 cursor-pointer select-none touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={(e) => handleTouchMove(e, items.length)}
        onTouchEnd={() => processSwipe(items.length, false)}
        onTouchCancel={() => processSwipe(items.length, false)}
        onMouseDown={handleMouseDown}
        onMouseMove={(e) => handleMouseMove(e, items.length)}
        onMouseUp={() => processSwipe(items.length, false)}
        onMouseLeave={() => { if (dragStartRef.current !== null) processSwipe(items.length, false); }}
        onWheel={(e) => handleWheel(e, items.length, false)}
        onDoubleClick={handleMediaDoubleTap}
      >
        <div
          ref={trackRef}
          className="relative flex transition-transform duration-300 ease-drawer h-auto w-full"
          style={{ transform: `translateX(-${currentMediaIndex * 100}%)` }}
        >
          {items.map((item, idx) => (
            <div
              key={`${id}-carousel-${idx}`}
              className="w-full flex-none overflow-hidden"
            >
              {item.type === 'image' ? (
                <CachedImage
                  src={getOptimizedImage(item.url, { width: 800, quality: 85 })}
                  alt={(item as any).alt || `Media ${idx + 1}`}
                  className="w-full block h-auto max-h-[850px] object-cover select-none [-webkit-user-drag:none] [-webkit-touch-callout:none]"
                  style={mediaItemRatio(item) ? { aspectRatio: String(mediaItemRatio(item)) } : undefined}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open picture ${idx + 1}`}
                  onClick={(e) => openViewerOnTap(items.slice(0, idx).filter((x: any) => x.type === 'image').length, e)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setViewerIndex(items.slice(0, idx).filter((x: any) => x.type === 'image').length); }}
                  {...guardImage}
                />
              ) : (
                <FeedVideo src={item.url} delayClick aspectHint={mediaItemRatio(item)} />
              )}
            </div>
          ))}
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
        <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2 pointer-events-none z-20">
          {currentMediaIndex > 0 && (
            <Button aria-label="Back"
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full bg-black/55 text-white hover:bg-black/75 pointer-events-auto shadow-lg"
              onClick={(e) => { e.stopPropagation(); setCurrentMediaIndex(prev => prev - 1); }}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="flex-1" />
          {currentMediaIndex < items.length - 1 && (
            <Button aria-label="Next"
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full bg-black/55 text-white hover:bg-black/75 pointer-events-auto shadow-lg"
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
            className="absolute bottom-3 left-5 z-30 p-2.5 rounded-full bg-black/70 hover:bg-black/90 backdrop-blur-md border border-white/25 text-white shadow-xl transition active:scale-90"
            title="See tagged people"
          >
            <User className="h-4 w-4 text-white" />
          </button>
        )}

        {/* Which picture of how many */}
        <div className="absolute top-3 left-3 z-20 rounded-full bg-black/60 backdrop-blur-md px-2.5 py-1 text-[12px] font-bold text-white tabular-nums" aria-label={`Picture ${currentMediaIndex + 1} of ${items.length}`}>
          {currentMediaIndex + 1}/{items.length}
        </div>

        {/* Dots Indicator */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 px-2 py-1 rounded-full bg-black/20 backdrop-blur-sm z-10">
          {items.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-[background-color,transform] duration-200 ${i === currentMediaIndex ? 'bg-primary scale-x-[2] scale-y-125' : 'bg-white/40'}`}
            />
          ))}
        </div>

        {isAIGenerated && (
          <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-md border border-white/20 text-white text-[12px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full z-20 shadow-lg">
            AI Generated
          </div>
        )}
      </div>
    );
  };

  if (hiddenLocal) return null;

  return (
    <>
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-lg bg-background/95 border-white/10 shadow-2xl rounded-[32px]">
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
              className="min-h-[150px] bg-foreground/5 border-foreground/10 rounded-2xl focus:ring-primary/50 text-foreground resize-none"
              autoFocus
            />

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest px-1">Manage Media ({editMediaItems.length})</p>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {editMediaItems.map((item: { url: string, type: 'image' | 'video' }, idx: number) => !item.url ? null : (
                  <div key={idx} className="relative group/edit flex-shrink-0 w-24 aspect-square rounded-xl overflow-hidden border border-foreground/10 hover:border-primary/50 transition duration-300">
                    {item.type === 'image' ? (
                      <CachedImage src={item.url} className="w-full h-full object-cover" alt="Edit thumbnail" />
                    ) : (
                      <div className="w-full h-full bg-black/40 flex items-center justify-center relative">
                        <Play className="w-6 h-6 text-white fill-white opacity-50" />
                        <CachedVideo src={item.url} preload="none" className="w-full h-full object-cover absolute inset-0 opacity-40" />
                      </div>
                    )}

                    {/* Delete button for individual media */}
                    <button aria-label="Close"
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
                    "w-24 aspect-square rounded-xl border-2 border-dashed border-foreground/10 hover:border-primary/50 flex flex-col items-center justify-center cursor-pointer transition group/add shrink-0 bg-foreground/5 hover:bg-primary/5",
                    isUploading && "cursor-not-allowed opacity-70"
                  )}
                >
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-6 w-6 text-muted-foreground group-hover/add:text-primary transition-colors" />
                      <span className="text-[12px] font-black text-muted-foreground group-hover/add:text-primary mt-1 uppercase tracking-[0.2em]">Add</span>
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
            <Button variant="ghost" onClick={() => setIsEditOpen(false)} className="rounded-xl hover:bg-foreground/5">
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
        <AlertDialogContent className="bg-background/95 border-white/10 shadow-2xl rounded-[32px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-red-500">Delete Post?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This action cannot be undone. This post will be permanently removed from the feed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-xl hover:bg-foreground/5 border-foreground/10">Cancel</AlertDialogCancel>
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
                      className={`shrink-0 text-xs font-bold px-4 py-1.5 rounded-lg transition border ${
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
                <button aria-label="Close" onClick={() => setShowTaggedSheet(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors">
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
              role="link"
              tabIndex={0}
              aria-label={pageInfo ? pageInfo.name : author.name}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.click(); }}
              onClick={() => {
                const path = pageInfo ? `/pages/${pageInfo.slug}` : (author.id ? `/profile/${author.id}` : '#');
                if (path !== '#') push(path);
              }}
              className="group/avatar relative z-10 cursor-pointer shrink-0 mr-3 transition-transform duration-150 active:scale-95 focus-visible:outline-none"
            >
              {/* a thin ring that warms to an orange gradient on hover or focus, like a story ring */}
              <span aria-hidden className={`absolute -inset-[2px] bg-gradient-to-tr from-[#FFB347] via-primary to-[#E63E28] opacity-0 transition-opacity duration-300 group-hover/avatar:opacity-100 group-focus-visible/avatar:opacity-100 ${pageInfo ? 'rounded-xl' : 'rounded-full'}`} />
              <span className={`relative block bg-background p-[2px] ring-1 ring-border/60 transition-transform duration-300 group-hover/avatar:scale-[1.04] ${pageInfo ? 'rounded-[10px]' : 'rounded-full'}`}>
                <Avatar className={`h-9 w-9 lg:h-10 lg:w-10 ${pageInfo ? 'rounded-lg' : ''}`}>
                  <AvatarImage src={getOptimizedImage(pageInfo ? (pageInfo.logo_url || "") : (author.avatar || ""), { width: 96, height: 96 }) || undefined} className={pageInfo ? 'rounded-lg' : ''} />
                  <AvatarFallback className={`bg-gradient-to-br from-primary to-secondary text-primary-foreground text-xs ${pageInfo ? 'rounded-lg' : ''}`}>
                    {pageInfo ? pageInfo.name.charAt(0).toUpperCase() : (author.initials || author.name?.slice(0, 2).toUpperCase() || '??')}
                  </AvatarFallback>
                </Avatar>
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  {/* line 1: name, tick, time and the one action, like Instagram */}
                  <div className="flex items-center gap-1.5 min-w-0 text-[13px] lg:text-sm leading-tight">
                    <div
                      role={pageInfo || author.id ? 'link' : undefined}
                      tabIndex={pageInfo || author.id ? 0 : undefined}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.click(); }}
                      onClick={() => { if (pageInfo) push(`/pages/${pageInfo.slug}`); else if (author.id) push(`/profile/${author.id}`); }}
                      className="relative z-10 flex items-center gap-1 min-w-0 cursor-pointer transition-opacity duration-150 hover:opacity-70 active:opacity-50"
                    >
                      <p className="font-serif font-semibold truncate normal-case tracking-tight">{pageInfo ? pageInfo.name : author.name}</p>
                      {(pageInfo ? pageInfo.is_verified : author.isVerified) && <VerificationBadge size="sm" />}
                      {!pageInfo && ['admin', 'moderator', 'super_admin'].includes(author.role?.toLowerCase() || '') && (
                        <StaffBadge role={author.role} showLabel={false} className="h-4 px-1" />
                      )}
                    </div>
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap" title={edited_at ? 'Edited' : undefined}>
                      <span aria-hidden className="mr-1.5">•</span>{timeAgo}{edited_at ? " · Edited" : ""}
                    </span>
                    {(audience === "connections" || audience === "private") && (
                      <span className="text-muted-foreground/80 shrink-0 text-xs border border-border/60 rounded-full px-1.5 py-px">
                        {audience === "connections" ? "Connections" : "Only me"}
                      </span>
                    )}
                    {shouldShowInlineAction && (
                      <>
                        <span aria-hidden className="text-muted-foreground shrink-0">•</span>
                        <button
                          onClick={handleInlineAction}
                          disabled={pageInfo ? toggleFollowPage.isPending : isSendingFollow}
                          className="shrink-0 text-primary font-semibold transition duration-150 hover:text-primary/70 active:scale-95 disabled:opacity-60 focus-visible:outline-none focus-visible:underline py-2 -my-2 px-1 -mx-1 animate-in fade-in duration-200"
                        >
                          {(pageInfo ? toggleFollowPage.isPending : isSendingFollow) ? 'Sending…' : (pageInfo || isFollowRelationship ? 'Follow' : 'Connect')}
                        </button>
                      </>
                    )}
                  </div>
                  {/* line 2: role and place, quiet */}
                  <div className="flex items-center gap-1.5 min-w-0 mt-0.5 text-[12px] text-muted-foreground">
                    <span className="truncate">{pageInfo ? "Company Page" : author.role}</span>
                    {(() => {
                      const displayLoc = location || (mediaItems && (mediaItems[0] as any)?.location);
                      if (!displayLoc) return null;
                      return (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            push(`/search?q=${encodeURIComponent(displayLoc)}`);
                          }}
                          className="shrink-0 min-w-0 flex items-center gap-1 transition-colors duration-150 hover:text-foreground hover:underline cursor-pointer relative z-10 py-1 -my-1"
                        >
                          <MapPin className="h-3 w-3 shrink-0 text-primary" />
                          <span className="truncate max-w-[40vw] sm:max-w-[220px]">{displayLoc}</span>
                        </button>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex-shrink-0 relative z-20">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-label="More options" variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-foreground/10 rounded-full transition">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-background/95 border-white/10 rounded-2xl shadow-xl">
                      {canManage ? (
                        <>
                          <DropdownMenuItem onClick={() => navigate(`/create?editPostId=${id}`)} className="rounded-lg gap-2 cursor-pointer focus:bg-foreground/5">
                            <Edit className="h-4 w-4 text-primary" />
                            <span>Edit Post</span>
                          </DropdownMenuItem>
                          {isOwner && (
                            <DropdownMenuItem onClick={() => setIsInsightsOpen(true)} className="rounded-lg gap-2 cursor-pointer focus:bg-foreground/5">
                              <span>View insights</span>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={copyLink} className="rounded-lg gap-2 cursor-pointer focus:bg-foreground/5">
                            <span>Copy link</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setIsDeleteOpen(true)} className="rounded-lg gap-2 cursor-pointer focus:bg-red-500/10 text-red-500 focus:text-red-500">
                            <Trash2 className="h-4 w-4" />
                            <span>Delete Post</span>
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <>
                          <DropdownMenuItem onClick={copyLink} className="rounded-lg gap-2 cursor-pointer focus:bg-foreground/5">
                            <span>Copy link</span>
                          </DropdownMenuItem>
                          {user && feedReason && (
                            <DropdownMenuItem onClick={() => toast({ title: 'Why you are seeing this', description: feedReasonText(feedReason), duration: 8000 })} className="rounded-lg gap-2 cursor-pointer focus:bg-foreground/5">
                              <span>Why am I seeing this?</span>
                            </DropdownMenuItem>
                          )}
                          {user && (
                            <>
                              <DropdownMenuItem onClick={notInterested} className="rounded-lg gap-2 cursor-pointer focus:bg-foreground/5">
                                <span>Not interested</span>
                              </DropdownMenuItem>
                              {(tags || []).slice(0, 2).map((t: string) => (
                                <DropdownMenuItem key={t} onClick={() => muteTopic(t)} className="rounded-lg gap-2 cursor-pointer focus:bg-foreground/5">
                                  <span>Mute #{t.replace(/^#/, '')}</span>
                                </DropdownMenuItem>
                              ))}
                              {targetAuthorId && (
                                <>
                                  <DropdownMenuItem onClick={muteThisAuthor} className="rounded-lg gap-2 cursor-pointer focus:bg-foreground/5">
                                    <span>Mute {author.name}</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={blockThisAuthor} className="rounded-lg gap-2 cursor-pointer focus:bg-red-500/10 text-red-500 focus:text-red-500">
                                    <span>Block {author.name}</span>
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem onClick={() => setIsReportOpen(true)} className="rounded-lg gap-2 cursor-pointer focus:bg-rose-500/10 text-rose-500 focus:text-rose-500">
                            <Flag className="h-4 w-4" />
                            <span>Report Content</span>
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <PostInsightsDialog postId={id} open={isInsightsOpen} onOpenChange={setIsInsightsOpen} />
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
              <div className="text-sm lg:text-base leading-relaxed">
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
                              className="text-primary text-sm lg:text-sm font-semibold hover:underline mt-1.5 block"
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
                              className="text-primary text-sm lg:text-sm font-semibold hover:underline mt-1.5 block"
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
                        className="text-primary text-sm lg:text-sm font-semibold hover:underline mt-1.5 block"
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
                        push(`/search?q=${encodeURIComponent(`#${String(tag).replace(/^#/, "")}`)}`);
                      }}
                      className="text-[12px] lg:text-sm font-semibold text-primary/80 hover:underline cursor-pointer bg-primary/5 px-2 py-0.5 rounded-full relative z-10"
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
            {isOwner && scheduled_at && <ScheduledBanner postId={id} scheduledAt={scheduled_at} />}
            {has_collabs && <CollaboratorsLine postId={id} />}
            {has_poll && <PostPoll postId={id} />}
            {link_preview?.url && link_preview?.title && !hasImage && !hasVideo && <LinkPreviewCard preview={link_preview} />}
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
                    <span className="text-sm font-semibold">
                      {isHideLikes ? (isLiked ? 'Liked' : 'Likes') : displayLikeCount}
                    </span>
                  </div>
                )}

                {isCommentsDisabled ? (
                  <div className="flex items-center gap-1.5 text-muted-foreground/60 cursor-not-allowed text-xs font-semibold" title="Comments turned off">
                    <MessageCircle size={24} className="opacity-40" />
                    <span className="text-[12px] italic">Off</span>
                  </div>
                ) : (
                  <button
                    onClick={handleComment}
                    aria-label="Comments"
                    className="flex items-center gap-1.5 transition duration-300 group/comment text-foreground/80 hover:text-primary"
                  >
                    <div className="p-2 -m-2 rounded-full group-hover/comment:bg-primary/10 transition-colors">
                      <MessageCircle size={24} />
                    </div>
                    <span className="text-sm font-semibold">{displayCommentCount}</span>
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
                <button aria-label="Save"
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
                  aria-pressed={isBookmarked}
                  className={`p-2 -m-2 transition-colors ${isBookmarked ? 'text-primary' : 'text-foreground hover:text-muted-foreground'}`}
                >
                  <Bookmark size={22} className={isBookmarked ? 'fill-current' : ''} />
                </button>
              )}
            </div>

            {isCommentsDisabled ? (
              <p className="text-muted-foreground text-xs italic pt-1 font-medium">Comments are turned off for this post.</p>
            ) : displayCommentCount > 0 ? (
              <button onClick={handleComment} className="text-muted-foreground text-sm lg:text-base hover:underline block pt-1">
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
              className="overflow-hidden border-t border-border bg-card"
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

      {viewerIndex !== null && (
        <Suspense fallback={null}>
          <ImageLightboxModal
            open
            onOpenChange={(o) => { if (!o) setViewerIndex(null); }}
            images={viewerImages}
            initialIndex={viewerIndex}
            senderName={pageInfo ? pageInfo.name : author.name}
            allowDownload={false}
            protectImages
          />
        </Suspense>
      )}
    </>
  );
};

export default PostCard;
