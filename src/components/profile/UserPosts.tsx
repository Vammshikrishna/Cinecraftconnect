import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Post } from '@/types';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import CommentSection from '@/components/feed/CommentSection';
import { InstagramShareSheet } from '@/components/feed/InstagramShareSheet';
import { formatDistanceToNow } from 'date-fns';
import { MoreVertical, Trash2, Edit2, Heart, MessageCircle, Share2, Play, Grid3x3, X, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
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
  
  // State for editing and deleting
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editMediaItems, setEditMediaItems] = useState<{ url: string; type: 'image' | 'video' }[]>([]);


  const handleShare = () => {
    setShowShareSheet(true);
  };

  useEffect(() => {
    if (!targetUserId) return;

    const fetchPosts = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles:author_id(id, full_name, username, avatar_url, craft)')
        .eq('author_id', targetUserId)
        .order('created_at', { ascending: false });

      if (!error && data) {
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
        .from('likes')
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
          .from('likes')
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
          .from('likes')
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

  const nextMedia = (max: number) => {
    setCurrentMediaIndex((prev) => (prev + 1) % max);
  };

  const prevMedia = (max: number) => {
    setCurrentMediaIndex((prev) => (prev - 1 + max) % max);
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
                  />
                ) : (
                  <img
                    src={post.media_items && post.media_items.length > 0 ? post.media_items[0].url : post.media_url}
                    alt="Post"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                )
              ) : (
                <div className="w-full h-full p-3 md:p-4 flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 text-center">
                  <p className="text-xs md:text-sm text-foreground line-clamp-6 font-medium">
                    {post.content}
                  </p>
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

      {/* Instagram-style Post Modal */}
      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent className="max-w-7xl w-full h-full lg:w-[95vw] lg:h-[95vh] p-0 gap-0 bg-black border-none">
          <VisuallyHidden>
            <DialogTitle>Post by {selectedPost?.profiles.full_name}</DialogTitle>
            <DialogDescription>
              View post details, like, comment, and share
            </DialogDescription>
          </VisuallyHidden>

          {(() => {
            if (!selectedPost) return null;
            const items = selectedPost?.media_items || (selectedPost?.media_url ? [{ url: selectedPost.media_url, type: selectedPost.media_type as 'image'|'video' }] : []);
            const currentItem = items[currentMediaIndex];
            const hasMultiple = items.length > 1;

            return (
              <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden">
                {/* Mobile Author Header (Hidden on Desktop) */}
                <div className="lg:hidden p-4 border-b border-border/10 bg-background flex items-center justify-between z-50 shrink-0">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 ring-1 ring-primary/20">
                      <AvatarImage src={selectedPost.profiles.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {selectedPost.profiles.full_name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-sm tracking-tight">{selectedPost.profiles.full_name}</p>
                      <p className="text-[10px] text-muted-foreground italic -mt-0.5 opacity-80">{selectedPost.profiles.craft || 'Artist'}</p>
                    </div>
                  </div>
                </div>

                {/* Media Container (Shared for Mobile/Desktop) */}
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

                  {/* Content Display */}
                  {currentItem ? (
                    currentItem.type === 'video' ? (
                      <video
                        key={currentItem.url}
                        src={currentItem.url}
                        controls
                        className="w-full h-full object-contain p-2 md:p-4"
                        autoPlay
                        playsInline
                      />
                    ) : (
                      <img
                        key={currentItem.url}
                        src={currentItem.url}
                        alt="Post"
                        className="w-full h-full object-contain p-2 md:p-4"
                      />
                    )
                  ) : (
                    <div className="p-12 text-center max-w-2xl">
                      <p className="text-white text-xl leading-relaxed">{selectedPost?.content}</p>
                    </div>
                  )}
                </div>

                {/* Info Container: Right panel */}
                <div className="w-full lg:w-[420px] flex flex-col bg-card border-l border-border/10 shrink-0 h-fit max-h-[45vh] lg:h-full lg:max-h-none overflow-hidden shadow-[-20px_0_60px_rgba(0,0,0,0.5)] order-2 lg:order-none z-10">
                  {/* Desktop Only Header */}
                  <div className="hidden lg:flex p-5 border-b border-border/10 items-center justify-between shrink-0 bg-background/50 backdrop-blur-xl">
                    <div className="flex items-center gap-3 font-outfit">
                      <Avatar className="h-11 w-11 ring-2 ring-primary/20 shadow-md">
                        <AvatarImage src={selectedPost?.profiles.avatar_url} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                          {selectedPost?.profiles.full_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-bold text-sm tracking-tight">{selectedPost?.profiles.full_name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-80">{selectedPost?.profiles.craft || 'Artist'}</p>
                      </div>
                    </div>
                    
                    {user?.id === selectedPost.author_id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10 rounded-full">
                            <MoreVertical className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[180px] bg-black/95 backdrop-blur-xl border-white/10 text-white">
                          <DropdownMenuItem onClick={() => setIsEditOpen(true)} className="focus:bg-white/10 focus:text-white cursor-pointer py-2.5">
                            <Edit2 className="mr-2 h-4 w-4" />
                            <span>Edit Post</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setIsDeleteOpen(true)} className="focus:bg-red-500/20 focus:text-red-500 text-red-500 cursor-pointer py-2.5">
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete Post</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {/* Actions Header (Mirroring Feed) */}
                  <div className="p-4 lg:p-5 border-b border-border/10 bg-background/50 backdrop-blur-2xl shrink-0 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <Button variant="ghost" size="icon" onClick={handleLike} className="hover:scale-125 transition-transform hover:bg-transparent p-0 h-auto">
                          <Heart className={`h-7 w-7 transition-all duration-300 ${isLiked ? 'fill-red-500 text-red-500 scale-110' : 'hover:text-red-500'}`} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => {/* Focus */}} className="hover:scale-125 transition-transform hover:bg-transparent p-0 h-auto">
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
                  <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6 custom-scrollbar scroll-smooth bg-background/30">
                    {selectedPost?.content && (
                      <div className="flex gap-3.5 items-start">
                        <Avatar className="h-9 w-9 shrink-0 shadow-sm border border-white/10">
                          <AvatarImage src={selectedPost.profiles.avatar_url} />
                          <AvatarFallback className="bg-primary/5 text-primary text-[10px]">{selectedPost.profiles.username?.charAt(0) || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="bg-primary/5 rounded-3xl rounded-tl-none p-4 border border-primary/5 shadow-sm">
                            <p className="text-[14px] leading-relaxed">
                              <span className="font-black text-primary mr-1.5 tracking-tight">{selectedPost.profiles.username}</span>
                              {selectedPost.content}
                            </p>
                          </div>
                          <p className="text-[9px] text-muted-foreground/60 mt-2.5 ml-1 flex items-center gap-1.5 uppercase tracking-widest font-black opacity-60">
                            • {formatDistanceToNow(new Date(selectedPost.created_at), { addSuffix: true })}
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
        <InstagramShareSheet
          isOpen={showShareSheet}
          onOpenChange={setShowShareSheet}
          postId={selectedPost.id}
        />
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl w-[95vw] bg-black/95 backdrop-blur-xl border-white/10 text-white p-0 overflow-hidden rounded-2xl">
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold tracking-tight">Edit Portfolio Post</h3>
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

              {editMediaItems.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-muted-foreground opacity-60">Media Assets ({editMediaItems.length})</label>
                  <ScrollArea className="h-[140px] w-full bg-white/5 rounded-xl border border-white/10 p-3">
                    <div className="flex gap-3">
                      {editMediaItems.map((item, idx) => (
                        <div key={idx} className="relative group/edit flex-shrink-0">
                          <div className="w-24 h-24 rounded-lg overflow-hidden ring-1 ring-white/10 shadow-lg">
                            {item.type === 'video' ? (
                              <video src={item.url} className="w-full h-full object-cover" />
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
                    </div>
                  </ScrollArea>
                </div>
              )}
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
