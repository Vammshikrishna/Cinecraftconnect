import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import PostCard from "./PostCard";
import CraftFilters from "./CraftFilters";
import { useRealtimePosts } from "@/hooks/useRealtimePosts";
import { performanceMonitor } from "@/utils/monitoring";
import { cacheManager } from "@/utils/caching";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";
import MediaUpload from "./MediaUpload";
import { ResponsiveGrid } from "@/components/ui/mobile-responsive-grid";
import { z } from "zod";
import { Post } from "@/types";

const postSchema = z.object({
  content: z.string().trim().optional(),
  tags: z.array(z.string().max(50)).max(10).optional()
});

interface FeedTabProps {
  postRatings: { [postId: string]: number };
  onRate: (postId: string, rating: number) => void;
}

const FeedTab = ({ postRatings, onRate }: FeedTabProps) => {
  const [activeFilter, setActiveFilter] = useState("All");
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState("");
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [postMediaUrl, setPostMediaUrl] = useState("");
  const [postMediaType, setPostMediaType] = useState<'image' | 'video' | null>(null);
  const { toast } = useToast();

  // Real-time posts subscription
  useRealtimePosts({
    onInsert: (newPost) => {
      setPosts(prev => [newPost as Post, ...prev]);
      cacheManager.invalidate('posts-feed');
      toast({
        title: "New post",
        description: "A new post was just added to the feed!",
      });
    },
    onUpdate: (updatedPost) => {
      setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost as Post : p));
      cacheManager.invalidate('posts-feed');
    },
    onDelete: (postId) => {
      setPosts(prev => prev.filter(p => p.id !== postId));
      cacheManager.invalidate('posts-feed');
    }
  });

  // Fetch posts from database with author profile data
  const fetchPosts = async () => {
    const stopTimer = performanceMonitor.startTimer('fetch-posts');

    // Check cache first
    const cached = cacheManager.get<Post[]>('posts-feed');
    if (cached) {
      setPosts(cached);
      setLoading(false);
      stopTimer();
      return;
    }

    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:author_id (
            id,
            full_name,
            username,
            avatar_url,
            craft
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user likes
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: likes } = await supabase
          .from('post_likes')
          .select('post_id')
          .eq('user_id', user.id);

        if (likes) {
          setLikedPostIds(new Set(likes.map(l => l.post_id).filter((id): id is string => id !== null)));
        }
      }

      const posts = ((data as any) || []).map((post: any) => ({
        ...post,
        like_count: post.like_count || 0
      }));
      setPosts(posts);
      cacheManager.set('posts-feed', posts, 300); // 5 minutes

      performanceMonitor.logToAnalytics('posts_fetched', {
        count: posts.length
      });
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: "Error",
        description: "Failed to load posts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      stopTimer();
    }
  };

  // Create new post
  const createPost = async () => {
    try {
      // Validate input
      const validation = postSchema.safeParse({
        content: newPostContent,
        tags: []
      });

      if (!validation.success) {
        toast({
          title: "Validation error",
          description: validation.error.issues[0].message,
          variant: "destructive",
        });
        return;
      }

      if (!validation.data.content && !postMediaUrl) {
        toast({
          title: "Empty post",
          description: "Please add some text or attach media to create a post",
          variant: "destructive",
        });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to create posts",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('posts')
        .insert([
          {
            author_id: user.id,
            content: validation.data.content || "",
            media_url: postMediaUrl || null,
            media_type: postMediaType || null,
            tags: validation.data.tags || [],
          }
        ]);

      if (error) throw error;

      setNewPostContent("");
      setPostMediaUrl("");
      setPostMediaType(null);
      setShowCreatePost(false);
      cacheManager.invalidate('posts-feed');
      fetchPosts(); // Refresh posts
      toast({
        title: "Success",
        description: "Post created successfully!",
      });

      performanceMonitor.logToAnalytics('post_created');
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: "Error",
        description: "Failed to create post",
        variant: "destructive",
      });
    }
  };

  const handleMediaUpload = (mediaUrl: string, mediaType: 'image' | 'video') => {
    setPostMediaUrl(mediaUrl);
    setPostMediaType(mediaType);
  };

  // Set up real-time subscription
  useEffect(() => {
    fetchPosts();

    const channel = supabase
      .channel('posts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts'
        },
        () => {
          fetchPosts(); // Refresh posts on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleLikeToggle = (postId: string, isLiked: boolean) => {
    setLikedPostIds(prev => {
      const newSet = new Set(prev);
      if (isLiked) {
        newSet.add(postId);
      } else {
        newSet.delete(postId);
      }
      return newSet;
    });

    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          like_count: isLiked ? p.like_count + 1 : Math.max(0, p.like_count - 1)
        };
      }
      return p;
    }));
  };

  return (
    <>
      <CraftFilters
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      {/* Create Post Card */}
      <Card className="glass-card p-6">
        {!showCreatePost ? (
          <Button
            onClick={() => setShowCreatePost(true)}
            className="w-full justify-start text-left bg-transparent hover:bg-accent border-dashed border-2 border-border h-12"
            variant="outline"
          >
            <PlusCircle className="mr-2 h-5 w-5" />
            Share your latest project or idea...
          </Button>
        ) : (
          <div className="space-y-4">
            <Textarea
              placeholder="What's happening in your creative world?"
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground min-h-[100px]"
            />

            <MediaUpload
              onMediaUpload={handleMediaUpload}
              disabled={false}
            />

            <div className="flex justify-between items-center">
              <div className="text-xs text-muted-foreground">
                {postMediaUrl && `${postMediaType} attached`}
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreatePost(false);
                    setNewPostContent("");
                    setPostMediaUrl("");
                    setPostMediaType(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={createPost}
                  disabled={!newPostContent.trim() && !postMediaUrl}
                  className="bg-gradient-to-r from-primary to-primary/80"
                >
                  Post
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Posts Feed */}
      <div className="mt-6">
        {posts.length === 0 ? (
          <Card className="glass-card p-8 text-center">
            <p className="text-muted-foreground mb-4">No posts yet. Be the first to share something!</p>
            <Button onClick={() => setShowCreatePost(true)} className="bg-gradient-to-r from-primary to-primary/80">
              Create First Post
            </Button>
          </Card>
        ) : (
          <ResponsiveGrid cols={{ sm: 1, md: 1 }} gap={6}>
            {posts.map((post) => {
              const author = post.profiles;
              const authorName = author?.full_name || author?.username || 'Anonymous User';
              const authorRole = author?.craft || 'Creator';
              const getInitials = (name: string) => {
                return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
              };

              return (
                <PostCard
                  key={post.id}
                  id={post.id}
                  author={{
                    id: author?.id,
                    name: authorName,
                    role: authorRole,
                    initials: getInitials(authorName),
                    avatar: author?.avatar_url || undefined
                  }}
                  timeAgo={new Date(post.created_at).toLocaleDateString()}
                  content={post.content}
                  hasImage={post.media_type === 'image'}
                  imageAlt={post.media_type === 'image' ? 'Post image' : undefined}
                  hasVideo={post.media_type === 'video'}
                  videoThumbnail={post.media_type === 'video' ? 'Post video' : undefined}
                  isAIGenerated={post.has_ai_generated}
                  like_count={post.like_count}
                  comment_count={post.comment_count}
                  share_count={post.share_count}
                  tags={post.tags || []}
                  rating={postRatings[post.id]}
                  currentUserLiked={likedPostIds.has(post.id)}
                  onRate={onRate}
                  onLikeToggle={handleLikeToggle}
                  mediaUrl={post.media_url}
                />
              );
            })}
          </ResponsiveGrid>
        )}
      </div>
    </>
  );
};

export default FeedTab;
