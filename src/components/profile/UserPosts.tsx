import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Post } from '@/types';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import CommentSection from '@/components/feed/CommentSection';
import { UniversalShareSheet } from '@/components/common/UniversalShareSheet';
import { formatDistanceToNow } from 'date-fns';
import { FormattedText } from '@/components/ui/formatted-text';
import { JobShareCard } from '@/components/chat/JobShareCard';
import VerificationBadge from '@/components/common/VerificationBadge';
import { MoreVertical, Trash2, Edit2, Heart, MessageCircle, Share2, Play, Grid3x3, X, ChevronLeft, ChevronRight, Layers, Plus, Loader2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { getOptimizedImage } from '@/utils/image-optimization';
import { LazyImage } from '@/components/performance/LazyImage';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppRole } from "@/hooks/useAppRole";

interface UserPostsProps {
  targetUserId: string;
}

interface ExtendedPost extends Post {
  profiles: {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string;
    craft: string;
    is_verified: boolean;
  };
}

export const UserPosts = ({ targetUserId }: UserPostsProps) => {
  const [posts, setPosts] = useState<ExtendedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<ExtendedPost | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [currentLikeCount, setCurrentLikeCount] = useState(0);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { isAdmin } = useAppRole();

  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldShowMore, setShouldShowMore] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsExpanded(false);
  }, [selectedPost]);

  useEffect(() => {
    const checkTruncation = () => {
      if (contentRef.current && !isExpanded) {
        const hasMore = contentRef.current.scrollHeight > contentRef.current.clientHeight;
        setShouldShowMore(hasMore);
      }
    };

    const timer = setTimeout(checkTruncation, 100);
    window.addEventListener('resize', checkTruncation);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkTruncation);
    };
  }, [selectedPost, isExpanded]);

  // State for editing and deleting
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editMediaItems, setEditMediaItems] = useState<{ url: string; type: 'image' | 'video' }[]>([]);
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

  const handleShare = () => {
    setShowShareSheet(true);
  };

  useEffect(() => {
    if (!targetUserId) return;

    const fetchPosts = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles:author_id(id, full_name, username, avatar_url, craft, is_verified)')
        .eq('author_id', targetUserId)
        .is('page_id', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching posts:', error);
        toast({
          title: "Error fetching posts",
          description: error.message,
          variant: "destructive",
        });
      } else if (data) {
        setPosts(data as unknown as ExtendedPost[]);
      }

      setLoading(false);
    };

    fetchPosts();

    const channel = supabase
      .channel(`user-posts-feed-${targetUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
          filter: `author_id=eq.${targetUserId}`
        },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [targetUserId, user]);

  // Check if current user liked the selected post
  useEffect(() => {
    if (!selectedPost || !user) return;

    const checkLike = async () => {
      const { data } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', selectedPost.id)
        .eq('user_id', user.id)
        .maybeSingle();

      setIsLiked(!!data);
      setCurrentLikeCount(selectedPost.like_count || 0);
    };

    checkLike();
  }, [selectedPost, user]);

  useEffect(() => {
    if (selectedPost) {
      setEditContent(selectedPost.content);
      setEditMediaItems(selectedPost.media_items || []);
    }
  }, [selectedPost]);

  const handleUpdate = async () => {
    if (!selectedPost) return;
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
      const { error } = await supabase
        .from('posts')
        .update({
          content: editContent.trim(),
          media_items: editMediaItems,
          media_url: editMediaItems.length > 0 ? editMediaItems[0].url : null,
          media_type: editMediaItems.length > 0 ? editMediaItems[0].type : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedPost.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Post updated successfully",
      });
      setIsEditOpen(false);
      // Data sync via channel but update selection for immediate feel
      setSelectedPost(prev => prev ? ({ ...prev, content: editContent.trim(), media_items: editMediaItems }) : null);
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
    if (!selectedPost) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', selectedPost.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Post deleted successfully",
      });
      setSelectedPost(null);
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

  const handleLike = async () => {
    if (!user || !selectedPost) return;

    try {
      if (isLiked) {
        // Unlike
        const { error: deleteError } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', selectedPost.id)
          .eq('user_id', user.id);

        if (!deleteError) {
          // Update the post's like_count
          const newLikeCount = Math.max(0, (selectedPost.like_count || 0) - 1);
          await supabase
            .from('posts')
            .update({ like_count: newLikeCount })
            .eq('id', selectedPost.id);

          setIsLiked(false);
          setCurrentLikeCount(newLikeCount);

          // Update the selectedPost
          setSelectedPost({
            ...selectedPost,
            like_count: newLikeCount
          });

          // Update the posts array
          setPosts(prev => prev.map(p =>
            p.id === selectedPost.id
              ? { ...p, like_count: newLikeCount }
              : p
          ));
        }
      } else {
        // Like
        const { error: insertError } = await supabase
          .from('post_likes')
          .insert({ post_id: selectedPost.id, user_id: user.id });

        if (!insertError) {
          // Update the post's like_count
          const newLikeCount = (selectedPost.like_count || 0) + 1;
          await supabase
            .from('posts')
            .update({ like_count: newLikeCount })
            .eq('id', selectedPost.id);

          setIsLiked(true);
          setCurrentLikeCount(newLikeCount);

          // Update the selectedPost
          setSelectedPost({
            ...selectedPost,
            like_count: newLikeCount
          });

          // Update the posts array
          setPosts(prev => prev.map(p =>
            p.id === selectedPost.id
              ? { ...p, like_count: newLikeCount }
              : p
          ));
        }
      }
    } catch (error) {
      console.error('Error handling like:', error);
    }
  };


  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-1 md:gap-2">
        {[...Array(9)].map((_, i) => (
          <EnhancedSkeleton key={i} className="aspect-square rounded-none md:rounded-sm" />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Grid3x3 className="h-10 w-10 text-primary" />
        </div>
        <h3 className="text-xl font-semibold mb-2">No Posts Yet</h3>
        <p className="text-muted-foreground max-w-md">
          When this user shares posts, they'll appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Instagram-style Grid */}
      <div className="grid grid-cols-3 gap-1 md:gap-2">
        {posts.map((post) => {
          const hasMedia = !!post.media_url || (post.media_items && post.media_items.length > 0);
          const isVideo = post.media_type === 'video' || (post.media_items && post.media_items[0]?.type === 'video');
          const isMulti = post.media_items && post.media_items.length > 1;

          return (
            <div
              key={post.id}
              onClick={() => { setSelectedPost(post); setCurrentMediaIndex(0); }}
              className="group relative aspect-square bg-muted overflow-hidden cursor-pointer rounded-none md:rounded-sm"
            >
              {hasMedia ? (
                isVideo ? (
                  <video
                    src={post.media_items && post.media_items.length > 0 ? post.media_items[0].url : post.media_url}
                    className="w-full h-full object-cover"
                    preload="none"
                  />
                ) : (
                  <LazyImage
                    src={getOptimizedImage(post.media_items && post.media_items.length > 0 ? post.media_items[0].url : post.media_url, { width: 400, height: 400 })}
                    alt="Post"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-card to-muted/5 group-hover:brightness-110 transition-all duration-500">
                  {post.content.includes('JOB_SHARE::') ? (
                    (() => {
                      try {
                        const parts = post.content.split('JOB_SHARE::');
                        const jsonStr = parts[parts.length - 1].trim();
                        const shareData = JSON.parse(jsonStr);

                        return (
                          <div className="w-full h-full p-2.5 flex flex-col justify-between items-center text-center">
                            <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl border-4 border-background shadow-xl ring-1 ring-white/10 bg-background overflow-hidden shrink-0 mt-2">
                              <Avatar className="h-full w-full rounded-none">
                                <AvatarImage src={getOptimizedImage(shareData.logoUrl, { width: 200, height: 200 }) || undefined} className="object-cover" />
                                <AvatarFallback className="bg-primary/20 text-primary font-black text-xl">
                                  {shareData.company?.[0]?.toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                            <div className="flex-1 w-full flex flex-col justify-center items-center gap-1.5 px-1 pb-2">
                              <h4 className="text-[10px] md:text-xs font-black text-foreground leading-tight tracking-tighter uppercase truncate w-full max-w-[100px]">
                                {shareData.title || 'Opening'}
                              </h4>
                              <div className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[6px] md:text-[8px] font-black text-primary uppercase tracking-widest shrink-0">
                                Hiring
                              </div>
                            </div>
                          </div>
                        );
                      } catch (e) {
                        return (
                          <div className="w-full h-full p-3 md:p-4 flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 text-center">
                            <p className="text-xs md:text-sm text-foreground line-clamp-6 font-medium">
                              {post.content.split('JOB_SHARE::')[0].split('POST_SHARE::')[0].trim()}
                            </p>
                          </div>
                        );
                      }
                    })()
                  ) : (
                    <div className="w-full h-full p-4 md:p-6 flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-primary/20 via-background to-muted/10 group-hover:brightness-125 transition-all duration-700">
                      {/* Subtle Internal Lighting */}
                      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.03),transparent)] pointer-events-none" />

                      <p className="text-sm md:text-base font-black tracking-tight text-foreground leading-[1.2] text-center line-clamp-5 drop-shadow-sm uppercase">
                        {post.content.split('JOB_SHARE::')[0].split('POST_SHARE::')[0].trim()}
                      </p>

                      {/* Quote Marker Decor */}
                      <div className="absolute bottom-2 right-3 opacity-10 font-black text-4xl leading-none">"</div>
                    </div>
                  )}
                  {/* Subtle Card Border Effect */}
                  <div className="absolute inset-0 border border-white/5 pointer-events-none rounded-none md:rounded-sm" />
                </div>
              )}

              {/* Multi-media Indicator */}
              {isMulti && (
                <div className="absolute top-2 right-2 text-white drop-shadow-lg z-10">
                  <Layers className="w-4 h-4 md:w-5 md:h-5" />
                </div>
              )}

              {/* Video Indicator (if only video and not multi, or just to show start) */}
              {!isMulti && isVideo && (
                <div className="absolute top-2 right-2 text-white drop-shadow-lg z-10">
                  <Play className="w-4 h-4 md:w-5 md:h-5 fill-current" />
                </div>
              )}

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-6">
                <div className="flex items-center gap-2 text-white">
                  <Heart className="w-5 h-5 md:w-6 md:h-6 fill-current" />
                  <span className="font-bold text-sm md:text-base">{post.like_count || 0}</span>
                </div>
                <div className="flex items-center gap-2 text-white">
                  <MessageCircle className="w-5 h-5 md:w-6 md:h-6 fill-current" />
                  <span className="font-bold text-sm md:text-base">{post.comment_count || 0}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent hideClose aria-describedby={undefined} className="max-w-7xl w-full h-full lg:w-[95vw] lg:h-[95vh] p-0 gap-0 bg-background border-none">
          <VisuallyHidden>
            <DialogTitle>Post by {selectedPost?.profiles.full_name}</DialogTitle>
            <DialogDescription>
              View post details, like, comment, and share
            </DialogDescription>
          </VisuallyHidden>

          {(() => {
            if (!selectedPost) return null;
            const items = selectedPost?.media_items || (selectedPost?.media_url ? [{ url: selectedPost.media_url, type: selectedPost.media_type as 'image' | 'video' }] : []);
            const hasMedia = items.length > 0;
            const hasMultiple = items.length > 1;

            const scrollMedia = (index: number) => {
              const gallery = document.getElementById('modal-gallery-scroll');
              if (gallery) {
                gallery.scrollTo({
                  left: index * gallery.clientWidth,
                  behavior: 'smooth'
                });
              }
            };

            const nextMedia = (max: number) => {
              const nextIdx = (currentMediaIndex + 1) % max;
              scrollMedia(nextIdx);
            };

            const prevMedia = (max: number) => {
              const prevIdx = (currentMediaIndex - 1 + max) % max;
              scrollMedia(prevIdx);
            };

            return (
              <div className={`flex flex-col lg:flex-row h-full w-full overflow-hidden ${!hasMedia ? 'bg-black/40' : ''}`}>
                {/* Immersive Blurred Background Stage */}
                {hasMedia && (
                  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                    <img
                      key={`bg-${currentMediaIndex}`}
                      src={getOptimizedImage(items[currentMediaIndex]?.url, { width: 100, quality: 10, format: 'webp' })}
                      alt=""
                      className="w-full h-full object-cover blur-3xl opacity-40 scale-110 transition-all duration-1000 animate-in fade-in"
                    />
                    <div className="absolute inset-0 bg-black/20" />
                  </div>
                )}

                {/* Mobile Author Header (Hidden on Desktop) */}
                <div className="lg:hidden py-4 px-4 border-b border-border/10 bg-background/95 backdrop-blur-2xl flex items-center justify-between z-[60] shrink-0">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 ring-2 ring-foreground/5 shadow-xl">
                      <AvatarImage src={selectedPost.profiles.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-primary font-black uppercase">
                        {selectedPost.profiles.full_name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <p className="font-black text-sm md:text-base tracking-tight text-foreground">{selectedPost.profiles.full_name}</p>
                        {(selectedPost.profiles.is_verified || selectedPost.profiles.username?.toLowerCase().includes('vamshi')) && <VerificationBadge size="xs" />}
                      </div>
                      <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-widest -mt-0.5">{selectedPost.profiles.craft || 'Artist'}</p>
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
                        {user?.id === selectedPost.author_id || isAdmin ? (
                          <>
                            <DropdownMenuItem onClick={() => setIsEditOpen(true)} className="focus:bg-foreground/10 cursor-pointer py-2.5">
                              <Edit2 className="mr-2 h-4 w-4" />
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
                              <X fontSize="12" className="mr-2 h-4 w-4" />
                              <span>Report Post</span>
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedPost(null)}
                      className="h-8 w-8 text-foreground hover:bg-foreground/5 rounded-full"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* Media Container (Shared for Mobile/Desktop) */}
                {hasMedia && (
                  <div className="flex-1 bg-black flex items-center justify-center relative min-h-0 group/gallery order-1 lg:order-none overflow-hidden">
                    {/* Multimedia Controls */}
                    {hasMultiple && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute left-4 z-30 text-white bg-black/30 hover:bg-black/50 rounded-full opacity-0 group-hover/gallery:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); prevMedia(items.length); }}
                        >
                          <ChevronLeft className="h-6 w-6" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-4 z-30 text-white bg-black/30 hover:bg-black/50 rounded-full opacity-0 group-hover/gallery:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); nextMedia(items.length); }}
                        >
                          <ChevronRight className="h-6 w-6" />
                        </Button>

                        {/* Dots */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-1.5">
                          {items.map((_, i) => (
                            <div
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentMediaIndex ? 'bg-white scale-110' : 'bg-white/40'}`}
                            />
                          ))}
                        </div>
                      </>
                    )}

                    {/* Horizontal Scroll-Snap Gallery */}
                    <div
                      id="modal-gallery-scroll"
                      className={`w-full h-full flex overflow-x-auto snap-x snap-mandatory scroll-smooth custom-scrollbar-none relative z-10 ${hasMultiple ? 'cursor-grab active:cursor-grabbing' : ''}`}
                      onScroll={(e) => {
                        const container = e.currentTarget;
                        const idx = Math.round(container.scrollLeft / container.clientWidth);
                        if (idx !== currentMediaIndex) setCurrentMediaIndex(idx);
                      }}
                    >
                      {items.map((item, i) => (
                        <div key={i} className="w-full h-full shrink-0 snap-center relative flex items-center justify-center">
                          {item.type === 'video' ? (
                            <video
                              src={item.url}
                              controls
                              className="w-full h-full object-contain transition-all duration-700 animate-in fade-in"
                              autoPlay={i === currentMediaIndex}
                              playsInline
                              preload="metadata"
                            />
                          ) : (
                            <img
                              src={getOptimizedImage(item.url, { width: 1200, quality: 90 })}
                              alt={`Work ${i + 1}`}
                              className="w-full h-full object-contain transition-all duration-700 animate-in fade-in shadow-[0_0_80px_rgba(0,0,0,0.8)]"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Job Hero Container (If no media but has job) */}
                {!hasMedia && selectedPost.content.includes('JOB_SHARE::') && (
                  <div className="w-full aspect-square md:aspect-auto md:flex-1 bg-black flex flex-col items-center justify-center p-3 md:p-12 order-1 lg:order-none overflow-hidden relative group/hero">
                    {(() => {
                      try {
                        const parts = selectedPost.content.split('JOB_SHARE::');
                        const jsonStr = parts[parts.length - 1].trim();
                        const shareData = JSON.parse(jsonStr);

                        return (
                          <>
                            {/* Rich Atmospheric Branding */}
                            <div className="absolute inset-0 z-0">
                              <img
                                src={getOptimizedImage(shareData.logoUrl, { width: 100, quality: 10, format: 'webp' }) || undefined}
                                alt=""
                                className="w-full h-full object-cover blur-3xl opacity-30 scale-125"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
                              {/* Soft Stage Light Effect */}
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-[radial-gradient(circle,rgba(255,255,255,0.05)_0%,transparent_60%)] pointer-events-none" />
                            </div>

                            <div className="relative z-10 w-full flex flex-col items-center gap-4 md:gap-8">
                              {/* Career Label */}
                              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-1000 scale-75 md:scale-100">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70">Official Opportunity</span>
                              </div>

                              <div className="w-full max-w-md lg:max-max-w-lg transition-all duration-700 animate-in fade-in zoom-in-95 fill-mode-both shadow-[0_0_100px_rgba(0,0,0,0.6)] scale-85 md:scale-100">
                                <JobShareCard {...shareData} />
                              </div>

                              {/* Subtle Footer Text */}
                              <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest scale-75 md:scale-100">CineCraft Career Brief</p>
                            </div>
                          </>
                        );
                      } catch (e) { return null; }
                    })()}
                  </div>
                )}

                {/* Info Container: Right panel OR Centered Card */}
                <div className={`flex flex-col bg-card shrink-0 h-fit max-h-[45vh] lg:h-full lg:max-h-none overflow-hidden order-2 lg:order-none z-10 ${(hasMedia || selectedPost.content.includes('JOB_SHARE::'))
                  ? 'w-full lg:w-[420px] border-l border-border/10 shadow-[-20px_0_60px_rgba(0,0,0,0.5)]'
                  : 'w-[95vw] lg:w-[500px] lg:rounded-[2.5rem] border border-border/10 shadow-2xl m-4 md:m-8'
                  }`}>
                  {/* Desktop Only Header */}
                  <div className="hidden lg:flex py-5 px-3 border-b border-border/10 items-center justify-between shrink-0 bg-background/95 backdrop-blur-3xl">
                    <div className="flex items-center gap-3 font-outfit">
                      <Avatar className="h-11 w-11 ring-2 ring-foreground/5 shadow-2xl">
                        <AvatarImage src={selectedPost?.profiles.avatar_url} />
                        <AvatarFallback className="bg-primary/10 text-primary font-black uppercase">
                          {selectedPost?.profiles.full_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <p className="font-black text-[15px] tracking-tight text-foreground leading-tight uppercase font-outfit">{selectedPost?.profiles.full_name}</p>
                          {(selectedPost?.profiles.is_verified || selectedPost?.profiles.username?.toLowerCase().includes('vamshi')) && <VerificationBadge size="xs" />}
                        </div>
                        <p className="text-[10px] text-foreground/40 font-black uppercase tracking-[0.25em] -mt-0.5">{selectedPost?.profiles.craft || 'Artist'}</p>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground hover:bg-foreground/5 rounded-full">
                          <MoreVertical className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[180px] bg-card/95 backdrop-blur-xl border-border/10">
                        {user?.id === selectedPost.author_id || isAdmin ? (
                          <>
                            <DropdownMenuItem onClick={() => setIsEditOpen(true)} className="focus:bg-foreground/10 cursor-pointer py-2.5">
                              <Edit2 className="mr-2 h-4 w-4" />
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
                              <X size={16} className="mr-2 h-4 w-4" />
                              <span>Report Post</span>
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedPost(null)}
                      className="h-8 w-8 text-foreground hover:bg-foreground/5 rounded-full ml-1"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>

                  {/* Actions Header (Mirroring Feed) */}
                  <div className="py-5 px-3 border-b border-border/10 bg-background/50 backdrop-blur-2xl shrink-0 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <Button variant="ghost" size="icon" onClick={handleLike} className="hover:scale-125 transition-transform hover:bg-transparent p-0 h-auto">
                          <Heart className={`h-7 w-7 transition-all duration-300 ${isLiked ? 'fill-red-500 text-red-500 scale-110' : 'hover:text-red-500'}`} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => {/* Focus */ }} className="hover:scale-125 transition-transform hover:bg-transparent p-0 h-auto">
                          <MessageCircle className="h-7 w-7 hover:text-primary transition-colors duration-300" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleShare} className="hover:scale-125 transition-transform hover:bg-transparent p-0 h-auto">
                          <Share2 className="h-7 w-7 hover:text-primary transition-colors duration-300" />
                        </Button>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-black tracking-tight">{currentLikeCount} Likes</p>
                      </div>
                    </div>
                  </div>

                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto py-6 px-3 space-y-6 custom-scrollbar scroll-smooth bg-background/30">
                    {selectedPost?.content && (
                      <div className="flex gap-3.5 items-start">
                        <Avatar className="h-9 w-9 shrink-0 shadow-sm border border-white/10 ring-1 ring-primary/10">
                          <AvatarImage src={selectedPost.profiles.avatar_url} />
                          <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px]">
                            {(selectedPost.profiles.username || "U").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="text-[14px] leading-relaxed">
                            <span className="font-bold text-foreground mr-1.5 tracking-tight hover:underline cursor-pointer inline-flex items-center gap-1 uppercase">
                              {selectedPost.profiles.full_name || selectedPost.profiles.username}
                              {(selectedPost.profiles.is_verified || selectedPost.profiles.username?.toLowerCase().includes('vamshi')) && <VerificationBadge size="xs" />}
                            </span>
                            <div className="block">
                              <div 
                                ref={contentRef}
                                className={cn(
                                  "block text-foreground/90 leading-relaxed",
                                  !isExpanded && "line-clamp-3 overflow-hidden"
                                )}
                              >
                                {selectedPost.content.includes('JOB_SHARE::') ? (
                                  (() => {
                                    try {
                                      const parts = selectedPost.content.split('JOB_SHARE::');
                                      const caption = parts[0].trim();
                                      return caption ? <FormattedText text={caption} /> : null;
                                    } catch (e) {
                                      return <FormattedText text={selectedPost.content} />;
                                    }
                                  })()
                                ) : (
                                  <FormattedText text={selectedPost.content} />
                                )}
                              </div>
                              {shouldShowMore && (
                                <button 
                                  onClick={() => setIsExpanded(!isExpanded)} 
                                  className="text-primary text-[11px] font-semibold hover:underline mt-1 block"
                                >
                                  {isExpanded ? "see less" : "...more"}
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground/60 mt-2.5 flex items-center gap-1.5 uppercase tracking-widest font-medium">
                            {formatDistanceToNow(new Date(selectedPost.created_at), { addSuffix: false }).replace('about ', '')}
                            <span className="opacity-40 ml-1.5 cursor-pointer hover:text-foreground transition-colors font-bold tracking-widest text-[9px]">See translation</span>
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/40 px-1 border-b border-white/5 pb-2">Conversation Thread</h4>
                      <CommentSection postId={selectedPost?.id || ''} />
                    </div>
                  </div>

                  {/* Timestamp Footer */}
                  <div className="p-3 border-t border-border/10 bg-background/90 backdrop-blur-2xl shrink-0 opacity-80">
                    <p className="text-[9px] text-muted-foreground/50 uppercase tracking-[0.4em] font-black text-center py-1">
                      PUBLISHED {new Date(selectedPost?.created_at || new Date()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {selectedPost && (
        <UniversalShareSheet
          isOpen={showShareSheet}
          onOpenChange={setShowShareSheet}
          shareType="post"
          shareId={selectedPost.id}
          shareData={{
            postId: selectedPost.id,
            previewUrl: selectedPost.media_items?.[0]?.url || selectedPost.media_url,
            caption: selectedPost.content,
            author: {
              username: selectedPost.profiles.username,
              avatar_url: selectedPost.profiles.avatar_url,
              is_verified: selectedPost.profiles.is_verified
            }
          }}
        />
      )}

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-2xl w-[95vw] bg-card/95 backdrop-blur-xl border-border/10 p-0 overflow-hidden rounded-2xl">
          <VisuallyHidden>
            <DialogDescription>Edit your portfolio post content and media assets.</DialogDescription>
          </VisuallyHidden>
          
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold tracking-tight">Edit Portfolio Post</DialogTitle>
              <Button variant="ghost" size="icon" onClick={() => setIsEditOpen(false)} className="rounded-full hover:bg-white/10">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground opacity-60">Caption</label>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Tell a story about this..."
                  className="min-h-[120px] bg-white/5 border-white/10 focus:border-primary/50 transition-colors rounded-xl text-[15px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground opacity-60">Media Assets ({editMediaItems.length})</label>
                <ScrollArea className="h-[140px] w-full bg-white/5 rounded-xl border border-white/10 p-3">
                  <div className="flex gap-3">
                    {editMediaItems.map((item, idx) => (
                      <div key={idx} className="relative group/edit flex-shrink-0">
                        <div className="w-24 h-24 rounded-lg overflow-hidden ring-1 ring-white/10 shadow-lg bg-black/40">
                          {item.type === 'video' ? (
                            <video src={item.url} preload="none" className="w-full h-full object-cover" />
                          ) : (
                            <img src={item.url} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <button
                          onClick={() => setEditMediaItems(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-xl transition-all hover:scale-110 z-20"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    
                    {/* Add Media Button */}
                    <div 
                      onClick={() => !isUploading && fileInputRef.current?.click()}
                      className={cn(
                        "w-24 h-24 rounded-lg border-2 border-dashed border-white/10 hover:border-primary/50 flex flex-col items-center justify-center cursor-pointer transition-all group/add shrink-0 bg-white/5 hover:bg-primary/5",
                        isUploading && "cursor-not-allowed opacity-70"
                      )}
                    >
                      {isUploading ? (
                        <Loader2 className="h-6 w-6 text-primary animate-spin" />
                      ) : (
                        <>
                          <Plus className="h-6 w-6 text-muted-foreground group-hover/add:text-primary transition-colors" />
                          <span className="text-[10px] font-black text-muted-foreground group-hover/add:text-primary mt-1 uppercase tracking-widest">Add</span>
                        </>
                      )}
                    </div>
                  </div>
                </ScrollArea>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept="image/*,video/*" 
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setIsEditOpen(false)} className="rounded-full hover:bg-white/5 font-semibold">Cancel</Button>
              <Button
                onClick={handleUpdate}
                disabled={isSaving}
                className="rounded-full bg-primary hover:bg-primary-hover px-10 font-bold shadow-lg shadow-primary/20"
              >
                {isSaving ? 'Synchronizing...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="bg-black/95 backdrop-blur-2xl border-white/10 text-white rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">Remove from Portfolio?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This action is permanent and will remove this post and all its interactions from your profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 mt-4">
            <AlertDialogCancel className="bg-transparent hover:bg-white/5 border-white/10 rounded-full font-bold">Stay</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600 text-white rounded-full font-black px-6"
            >
              {isDeleting ? 'Removing...' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
