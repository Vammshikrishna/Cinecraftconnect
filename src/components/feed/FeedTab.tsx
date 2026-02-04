import { useState, useEffect, useMemo } from "react";
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
import { z } from "zod";
import { Post } from "@/types";
import { useHomeFeed } from "@/hooks/useHomeFeed";
import { useConnections } from "@/hooks/useConnections";
import { FirstContentBlock, SecondContentBlock } from "./FeedWidgets";
import { useAuth } from "@/contexts/AuthContext";

const postSchema = z.object({
  content: z.string().trim().optional(),
  tags: z.array(z.string().max(50)).max(10).optional()
});

interface FeedTabProps {
  postRatings: { [postId: string]: number };
  onRate: (postId: string, rating: number) => void;
}

const FeedTab = ({ postRatings, onRate }: FeedTabProps) => {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState("All");
  const [localPosts, setLocalPosts] = useState<Post[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [newPostContent, setNewPostContent] = useState("");
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [postMediaUrl, setPostMediaUrl] = useState("");
  const [postMediaType, setPostMediaType] = useState<'image' | 'video' | null>(null);
  const { toast } = useToast();

  // 1. Fetch Holistic Feed Data
  const { data: homeFeed, isLoading } = useHomeFeed();
  const { connections, sendConnectionRequest } = useConnections();

  // Initialize local posts from homeFeed
  useEffect(() => {
    if (homeFeed?.posts) {
      setLocalPosts((prev) => {
        // Merge logic if needed, but for now reset on fresh fetch to respect algorithm
        // Or better, only set if empty to allow realtime additions.
        if (prev.length === 0) return homeFeed.posts;
        return prev;
      });
      if (homeFeed.likedPostIds) {
        setLikedPostIds(homeFeed.likedPostIds);
      }
    }
  }, [homeFeed]);

  // Real-time posts subscription
  useRealtimePosts({
    onInsert: (newPost) => {
      // Add new items to top locally
      setLocalPosts(prev => [newPost as Post, ...prev]);
      cacheManager.invalidate('posts-feed');
      toast({
        title: "New post",
        description: "A new post was just added to the feed!",
      });
    },
    onUpdate: (updatedPost) => {
      setLocalPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost as Post : p));
      cacheManager.invalidate('posts-feed');
    },
    onDelete: (postId) => {
      setLocalPosts(prev => prev.filter(p => p.id !== postId));
      cacheManager.invalidate('posts-feed');
    }
  });

  // Calculate Sorted Feed
  const feedItems = useMemo(() => {
    if (!localPosts.length) return [];

    // 1. Identify Connection IDs
    const connectionIds = new Set<string>();
    connections.forEach(c => {
      connectionIds.add(c.follower_id);
      connectionIds.add(c.following_id);
    });

    // 2. Sorting Algorithm
    // - Bucket 1: My Posts & Connection Posts (Recent)
    // - Bucket 2: Others (Sorted by "Smart" score: Likes + Recent?) -> For now, purely chronological for "Others" but we could sort by likes.
    // User requested: "first user connectttion post and next smart in between the posts all the others"

    const myAndFriendsPosts = [];
    const otherPosts = [];

    for (const post of localPosts) {
      if (post.author_id === user?.id || connectionIds.has(post.author_id)) {
        myAndFriendsPosts.push(post);
      } else {
        otherPosts.push(post);
      }
    }

    // Sort friends posts by date (newest first)
    myAndFriendsPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Sort others by "Smart" (e.g. Likes count desc) to fulfill "Smart" requirement, then Date
    // Actually user said "next smart... all others". Let's split others into "Top" and "Rest".
    // Let's define "Smart" as posts with > 5 likes? Or just top 20%?
    // Simplified: Sort 'otherPosts' by like_count descending first? 
    // Let's keep strict chronological for 'others' to avoid stale old posts showing up just because they are popular, 
    // unless we implement a real score ( (likes+1) / (age+2)^1.8 ).
    // For now, let's just stick to: Connections -> Others.

    // Check if user specifically requested "Smart" as a category. Yes.
    // Let's try to bubble up high-engagement non-connection posts.
    const smartThreshold = 2; // Arbitrary
    const smartPosts = otherPosts.filter(p => (p.like_count || 0) >= smartThreshold);
    const normalPosts = otherPosts.filter(p => (p.like_count || 0) < smartThreshold);

    // Sort smart by likes
    smartPosts.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));

    // Sort normal by date
    normalPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Combined List
    const sortedPosts = [...myAndFriendsPosts, ...smartPosts, ...normalPosts];

    // 3. Injection Logic
    // "for 4 posts there need show [Block A] and for three post the [Block B]"
    // Interpretation: 
    // Index 0-3: Posts (4 posts)
    // Index 4: Block A
    // Index 4-6 (orig 4-6): Posts (3 posts) -> RANDOMIZE THESE
    // Index 7: Block B
    // Rest of posts

    const items = [];
    const blockAIndex = 4;
    const blockBIndex = 7; // 4 + 3

    // Helper: Random shuffle
    const shuffleArray = (array: any[]) => {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    };

    // Slice out the group between A and B
    // Group 1: 0-4 (0, 1, 2, 3)
    // Group 2: 4-7 (4, 5, 6) -> Shuffle this!
    // Group 3: 7+

    // We only shuffle if we have enough items to fill the gap.
    if (sortedPosts.length >= blockBIndex) {
      const group1 = sortedPosts.slice(0, blockAIndex);
      const group2 = sortedPosts.slice(blockAIndex, blockBIndex);
      const group3 = sortedPosts.slice(blockBIndex);

      const shuffledGroup2 = shuffleArray([...group2]); // Shuffle copy

      // Reassemble
      const finalPosts = [...group1, ...shuffledGroup2, ...group3];

      for (let i = 0; i < finalPosts.length; i++) {
        items.push({ type: 'post', data: finalPosts[i] });

        if (i + 1 === blockAIndex) {
          items.push({ type: 'blockA', data: null });
        }
        if (i + 1 === blockBIndex) {
          items.push({ type: 'blockB', data: null });
        }
      }
    } else {
      // Fallback for short lists (no shuffle needed or possible)
      for (let i = 0; i < sortedPosts.length; i++) {
        items.push({ type: 'post', data: sortedPosts[i] });

        if (i + 1 === blockAIndex) {
          items.push({ type: 'blockA', data: null });
        }
        if (i + 1 === blockBIndex) {
          items.push({ type: 'blockB', data: null });
        }
      }
    }

    // If we have fewer posts than the blocks, we might want to append widgets at the end?
    // Current logic: only injects if we have enough posts. 
    // If < 4 posts, Block A won't show.
    // Let's force show them if we run out of posts? 
    // User said "in between", implying separation. I'll leave as is.
    // But realistically, if only 2 posts exist, we might still want to see Announcements.
    // Let's ensure they appear at the end if not already injected.

    const hasBlockA = sortedPosts.length >= blockAIndex;
    const hasBlockB = sortedPosts.length >= blockBIndex;

    if (!hasBlockA) items.push({ type: 'blockA', data: null });
    else if (!hasBlockB && sortedPosts.length >= blockAIndex) items.push({ type: 'blockB', data: null }); // Only if passed A but not B

    return items;
  }, [localPosts, connections, user?.id]);


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
      // refetch(); // No need, realtime handles it
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

    setLocalPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          like_count: isLiked ? (p.like_count || 0) + 1 : Math.max(0, (p.like_count || 0) - 1)
        };
      }
      return p;
    }));
  };

  if (isLoading && localPosts.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

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

      {/* Posts Feed with Injected Blocks */}
      <div className="mt-6 space-y-6">
        {feedItems.length === 0 ? (
          <Card className="glass-card p-8 text-center">
            <p className="text-muted-foreground mb-4">No posts yet. Be the first to share something!</p>
            <Button onClick={() => setShowCreatePost(true)} className="bg-gradient-to-r from-primary to-primary/80">
              Create First Post
            </Button>
          </Card>
        ) : (
          <div className="space-y-6">
            {feedItems.map((item, index) => {
              if (item.type === 'blockA') {
                return (
                  <FirstContentBlock
                    key={`blockA-${index}`}
                    announcements={homeFeed?.announcements || []}
                    projects={homeFeed?.projects || []}
                    discussions={homeFeed?.discussions || []}
                    ratings={homeFeed?.ratings || []}
                  />
                );
              }
              if (item.type === 'blockB') {
                return (
                  <SecondContentBlock
                    key={`blockB-${index}`}
                    creators={homeFeed?.connections || []}
                    marketplace={homeFeed?.marketplace || []}
                    vendors={homeFeed?.vendors || []}
                    onConnect={(id) => sendConnectionRequest(id)}
                  />
                );
              }

              // Post
              const post = item.data;
              if (!post) return null;

              const author = post.profiles;
              const authorName = author?.full_name || author?.username || 'Anonymous User';
              const authorRole = author?.craft || 'Creator';
              const getInitials = (name: string) => {
                return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
              };

              return (
                <PostCard
                  key={`post-${post.id}`}
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
          </div>
        )}
      </div>
    </>
  );
};

export default FeedTab;
