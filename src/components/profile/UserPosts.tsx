import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Post } from '@/types';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Share2, Play, Grid3x3, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import CommentSection from '@/components/feed/CommentSection';
import { InstagramShareSheet } from '@/components/feed/InstagramShareSheet';

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
  const [isLiked, setIsLiked] = useState(false);
  const [currentLikeCount, setCurrentLikeCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const { user } = useAuth();

  const handleComment = () => {
    setShowComments(!showComments);
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
          const hasMedia = !!post.media_url;
          const isVideo = post.media_type === 'video';

          return (
            <div
              key={post.id}
              onClick={() => setSelectedPost(post)}
              className="group relative aspect-square bg-muted overflow-hidden cursor-pointer rounded-none md:rounded-sm"
            >
              {hasMedia ? (
                isVideo ? (
                  <video
                    src={post.media_url}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={post.media_url}
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

              {/* Video Indicator */}
              {isVideo && (
                <div className="absolute top-2 right-2 text-white drop-shadow-lg">
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

          {/* Mobile Layout - Full Screen Image with Bottom Overlay */}
          <div className="lg:hidden flex flex-col h-full w-full relative group overflow-hidden">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-20 text-white hover:bg-white/20 rounded-full"
              onClick={() => setSelectedPost(null)}
            >
              <X className="h-5 w-5" />
            </Button>

            {/* Full Screen Image */}
            <div className="flex-1 bg-black flex items-center justify-center relative min-h-0">
              {selectedPost?.media_url ? (
                selectedPost.media_type === 'video' ? (
                  <video
                    src={selectedPost.media_url}
                    controls
                    className="w-full h-full object-contain"
                    autoPlay
                    playsInline
                  />
                ) : (
                  <img
                    src={selectedPost.media_url}
                    alt="Post"
                    className="w-full h-full object-contain"
                  />
                )
              ) : (
                <div className="p-12 text-center max-w-2xl">
                  <p className="text-white text-xl leading-relaxed">{selectedPost?.content}</p>
                </div>
              )}
            </div>

            {/* Bottom Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/95 via-black/80 to-transparent pt-12 p-4 pb-6 backdrop-blur-[1px]">
              {/* User Info & Caption */}
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9 ring-1 ring-white/30">
                    <AvatarImage src={selectedPost?.profiles.avatar_url} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {selectedPost?.profiles.full_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm text-white shadow-black drop-shadow-md">
                      {selectedPost?.profiles.full_name}
                    </p>
                    <p className="text-xs text-white/80">
                      @{selectedPost?.profiles.username}
                    </p>
                  </div>
                </div>

                {/* Mobile Caption */}
                {selectedPost?.content && selectedPost.media_url && (
                  <p className="text-sm text-white/90 line-clamp-2 px-1 text-shadow-sm">
                    {selectedPost.content}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLike}
                    className="hover:bg-white/10 text-white p-0 h-auto w-auto hover:scale-110 transition-transform"
                  >
                    <Heart
                      className={`h-7 w-7 transition-all ${isLiked
                        ? 'fill-red-500 text-red-500 scale-110'
                        : 'text-white'
                        }`}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleComment}
                    className="hover:bg-white/10 text-white p-0 h-auto w-auto hover:scale-110 transition-transform"
                  >
                    <MessageCircle className="h-7 w-7" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleShare}
                    className="hover:bg-white/10 text-white p-0 h-auto w-auto hover:scale-110 transition-transform"
                  >
                    <Share2 className="h-7 w-7" />
                  </Button>
                </div>

                {/* Like Count & Date */}
                <div className="text-right">
                  <p className="font-bold text-sm text-white">
                    {currentLikeCount} {currentLikeCount === 1 ? 'like' : 'likes'}
                  </p>
                  <p className="text-[10px] text-white/60 uppercase tracking-widest font-medium">
                    {new Date(selectedPost?.created_at || new Date()).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Mobile Comments Sheet with Full Details */}
            {showComments && (
              <div className="absolute inset-x-0 bottom-0 h-[85vh] bg-background rounded-t-2xl z-30 flex flex-col animate-in slide-in-from-bottom-full duration-300 shadow-2xl border-t border-white/10">
                <div className="flex items-center justify-center p-3 border-b relative shrink-0">
                  <div className="w-12 h-1 bg-muted rounded-full absolute top-2" />
                  <h3 className="font-semibold mt-2">Post Details</h3>
                  <Button variant="ghost" size="icon" className="absolute right-2 top-2" onClick={() => setShowComments(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {/* Post Details (visible in sheet for mobile/tablet) */}
                  <div className="mb-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={selectedPost?.profiles.avatar_url} />
                        <AvatarFallback>{selectedPost?.profiles.full_name?.charAt(0) || 'U'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-sm">{selectedPost?.profiles.full_name}</p>
                        <p className="text-xs text-muted-foreground">@{selectedPost?.profiles.username}</p>
                      </div>
                    </div>

                    {selectedPost?.content && (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedPost.content}</p>
                    )}

                    {selectedPost?.tags && selectedPost.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedPost.tags.map((tag, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">#{tag}</Badge>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(selectedPost?.created_at || new Date()), { addSuffix: true })}
                    </p>

                    <div className="border-b border-border/50" />
                  </div>

                  <h4 className="font-semibold mb-4 text-sm">Comments</h4>
                  <CommentSection postId={selectedPost?.id || ''} />
                </div>
              </div>
            )}
          </div>

          {/* Desktop Layout - Side by Side (lg+) */}
          <div className="hidden lg:flex h-full w-full flex-row overflow-hidden">
            {/* Left: Media */}
            <div className="flex-1 bg-black flex items-center justify-center relative min-h-0">
              {selectedPost?.media_url ? (
                selectedPost.media_type === 'video' ? (
                  <video
                    src={selectedPost.media_url}
                    controls
                    className="w-full h-full object-contain p-4"
                    autoPlay
                  />
                ) : (
                  <img
                    src={selectedPost.media_url}
                    alt="Post"
                    className="w-full h-full object-contain p-4"
                  />
                )
              ) : (
                <div className="p-12 text-center max-w-2xl">
                  <p className="text-white text-xl leading-relaxed">{selectedPost?.content}</p>
                </div>
              )}
            </div>

            {/* Right: Details */}
            <div className="w-[350px] lg:w-[400px] flex flex-col bg-card border-l border-border/50">
              {/* Header */}
              <div className="p-4 border-b border-border/50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                    <AvatarImage src={selectedPost?.profiles.avatar_url} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {selectedPost?.profiles.full_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm">
                      {selectedPost?.profiles.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      @{selectedPost?.profiles.username}
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Post Content */}
                {selectedPost?.content && (
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={selectedPost.profiles.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {selectedPost.profiles.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm leading-relaxed">
                        <span className="font-semibold mr-2">
                          {selectedPost.profiles.username}
                        </span>
                        {selectedPost.content}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(selectedPost.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                )}

                {/* Tags */}
                {selectedPost?.tags && selectedPost.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {selectedPost.tags.map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs hover:bg-primary/10 transition-colors">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Desktop Comments Section */}
                {showComments && (
                  <div className="pt-4 mt-2 border-t border-border/50 animate-in fade-in duration-300">
                    <CommentSection postId={selectedPost?.id || ''} />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="border-t border-border/50 p-4 space-y-3 shrink-0 bg-card/50 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLike}
                    className="hover:scale-110 transition-transform hover:bg-transparent"
                  >
                    <Heart
                      className={`h-6 w-6 transition-all ${isLiked
                        ? 'fill-red-500 text-red-500 scale-110'
                        : 'hover:text-red-500'
                        }`}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleComment}
                    className="hover:scale-110 transition-transform hover:bg-transparent"
                  >
                    <MessageCircle className="h-6 w-6 hover:text-primary transition-colors" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleShare}
                    className="hover:scale-110 transition-transform hover:bg-transparent"
                  >
                    <Share2 className="h-6 w-6 hover:text-primary transition-colors" />
                  </Button>
                </div>

                <div className="space-y-1">
                  <p className="font-semibold text-sm">
                    {currentLikeCount} {currentLikeCount === 1 ? 'like' : 'likes'}
                  </p>
                  {selectedPost?.comment_count !== undefined && selectedPost.comment_count > 0 && (
                    <p className="text-sm text-muted-foreground">
                      View all {selectedPost.comment_count} {selectedPost.comment_count === 1 ? 'comment' : 'comments'}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {new Date(selectedPost?.created_at || new Date()).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog >

      {selectedPost && (
        <InstagramShareSheet
          isOpen={showShareSheet}
          onOpenChange={setShowShareSheet}
          postId={selectedPost.id}
        />
      )
      }
    </>
  );
};
