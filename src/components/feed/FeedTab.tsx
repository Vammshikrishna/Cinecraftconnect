import { useState, useEffect, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import PostCard from "./PostCard";
import CraftFilters from "./CraftFilters";
import VerificationBadge from "../common/VerificationBadge";
import { useRealtimePosts } from "@/hooks/useRealtimePosts";
import { performanceMonitor } from "@/utils/monitoring";
import { cacheManager } from "@/utils/caching";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";
import MediaUpload from "./MediaUpload";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { z } from "zod";
import { Post } from "@/types";
import { useHomeFeed } from "@/hooks/useHomeFeed";
import { useConnections } from "@/hooks/useConnections";
import { FirstContentBlock, SecondContentBlock } from "./FeedWidgets";
import { useAuth } from "@/contexts/AuthContext";
import { PostSkeleton, AnnouncementSkeleton, ProjectSkeleton } from "@/components/ui/enhanced-skeleton";
import { FeedSkeleton } from "@/pages/Feed";
import { AccountSwitcherSheet } from "@/components/profile/AccountSwitcherSheet";

const postSchema = z.object({
  content: z.string().trim().optional(),
  tags: z.array(z.string().max(50)).max(10).optional()
});

interface FeedTabProps {
  postRatings: { [postId: string]: number };
  onRate: (postId: string, rating: number) => void;
}

const FeedTab = ({ postRatings, onRate }: FeedTabProps) => {
  const { user, profile } = useAuth();
  const [activeFilter, setActiveFilter] = useState("All");
  const [localPosts, setLocalPosts] = useState<Post[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<string[]>([]);
  const [newPostContent, setNewPostContent] = useState("");
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [mediaItems, setMediaItems] = useState<{ url: string, type: 'image' | 'video' }[]>([]);
  const { toast } = useToast();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isAccountSwitcherOpen, setIsAccountSwitcherOpen] = useState(false);

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  // 1. Fetch Holistic Feed Data
  const { data: homeFeed, isLoading } = useHomeFeed();
  const { connections, sendConnectionRequest } = useConnections();

  // Initialize local posts from homeFeed
  useEffect(() => {
    if (homeFeed?.posts) {
      setLocalPosts((prev) => {
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

    const connectionIds = new Set<string>();
    connections.forEach(c => {
      connectionIds.add(c.follower_id);
      connectionIds.add(c.following_id);
    });

    const myAndFriendsPosts = [];
    const otherPosts = [];

    for (const post of localPosts) {
      if (post.author_id === user?.id || connectionIds.has(post.author_id)) {
        myAndFriendsPosts.push(post);
      } else {
        otherPosts.push(post);
      }
    }

    myAndFriendsPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const smartThreshold = 2;
    const smartPosts = otherPosts.filter(p => (p.like_count || 0) >= smartThreshold);
    const normalPosts = otherPosts.filter(p => (p.like_count || 0) < smartThreshold);

    smartPosts.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
    normalPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const sortedPosts = [...myAndFriendsPosts, ...smartPosts, ...normalPosts];

    const items = [];
    const blockAIndex = 4;
    const blockBIndex = 7;

    const shuffleArray = (array: any[]) => {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    };

    if (sortedPosts.length >= blockBIndex) {
      const group1 = sortedPosts.slice(0, blockAIndex);
      const group2 = sortedPosts.slice(blockAIndex, blockBIndex);
      const group3 = sortedPosts.slice(blockBIndex);
      const shuffledGroup2 = shuffleArray([...group2]);
      const finalPosts = [...group1, ...shuffledGroup2, ...group3];

      for (let i = 0; i < finalPosts.length; i++) {
        items.push({ type: 'post', data: finalPosts[i] });
        if (i + 1 === blockAIndex) items.push({ type: 'blockA', data: null });
        if (i + 1 === blockBIndex) items.push({ type: 'blockB', data: null });
      }
    } else {
      for (let i = 0; i < sortedPosts.length; i++) {
        items.push({ type: 'post', data: sortedPosts[i] });
        if (i + 1 === blockAIndex) items.push({ type: 'blockA', data: null });
        if (i + 1 === blockBIndex) items.push({ type: 'blockB', data: null });
      }
    }

    const hasBlockA = sortedPosts.length >= blockAIndex;
    const hasBlockB = sortedPosts.length >= blockBIndex;
    if (!hasBlockA) items.push({ type: 'blockA', data: null });
    else if (!hasBlockB && sortedPosts.length >= blockAIndex) items.push({ type: 'blockB', data: null });

    return items;
  }, [localPosts, connections, user?.id]);


  const createPost = async () => {
    try {
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

      if (!validation.data.content && mediaItems.length === 0) {
        toast({
          title: "Empty post",
          description: "Please add some text or attach media to create a post",
          variant: "destructive",
        });
        return;
      }

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
            media_url: mediaItems.length > 0 ? mediaItems[0].url : null,
            media_type: mediaItems.length > 0 ? mediaItems[0].type : null,
            media_items: mediaItems,
            tags: validation.data.tags || [],
          }
        ]);

      if (error) throw error;

      setNewPostContent("");
      setMediaItems([]);
      setShowCreatePost(false);
      cacheManager.invalidate('posts-feed');
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

  const handleMediaUpload = (items: { url: string, type: 'image' | 'video' }[]) => {
    setMediaItems(items);
  };

  const handleLikeToggle = (postId: string, isLiked: boolean) => {
    setLikedPostIds(prev => {
      if (isLiked) return [...prev, postId];
      return prev.filter(id => id !== postId);
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
    return <FeedSkeleton />;
  }

  return (
    <div className="flex justify-center gap-6 lg:gap-10 max-w-[1180px] mx-auto pt-2 lg:pt-4 px-4 sm:px-0">
      {/* Main Feed Column */}
      <div className="w-full max-w-[560px] space-y-4">
        <CraftFilters
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />

      <Card className="glass-card p-4 lg:p-5">
        {!showCreatePost ? (
          <Button
            onClick={() => setShowCreatePost(true)}
            className="w-full justify-start text-left bg-transparent hover:bg-accent border-dashed border-2 border-border h-10 lg:h-11"
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
              className="bg-input border-border text-foreground placeholder:text-muted-foreground min-h-[80px]"
            />

            <MediaUpload
              onMediaUpload={handleMediaUpload}
              disabled={false}
            />

            <div className="flex justify-between items-center">
              <div className="text-xs text-muted-foreground">
                {mediaItems.length > 0 && `${mediaItems.length} items attached`}
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" onClick={() => { setShowCreatePost(false); setNewPostContent(""); setMediaItems([]); }}>
                  Cancel
                </Button>
                <Button onClick={createPost} disabled={!newPostContent.trim() && mediaItems.length === 0} className="bg-gradient-to-r from-primary to-primary/80">
                  Post
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      <div className="mt-4 lg:mt-5 space-y-4 lg:space-y-5">
        {feedItems.length === 0 ? (
          <Card className="glass-card p-8 text-center">
            <p className="text-muted-foreground mb-4">No posts yet. Be the first to share something!</p>
            <Button onClick={() => setShowCreatePost(true)} className="bg-gradient-to-r from-primary to-primary/80">
              Create First Post
            </Button>
          </Card>
        ) : (
          <div className="space-y-4 lg:space-y-5">
            {feedItems.map((item, index) => {
              if (item.type === 'blockA') {
                return (
                  <FirstContentBlock
                    key={`blockA-${index}`}
                    announcements={(homeFeed?.announcements || [])
                        .filter((item: any) => !dismissedIds.has(item.id))
                        .slice(0, 7)}
                    projects={(homeFeed?.projects || [])
                        .filter((item: any) => !dismissedIds.has(item.id))
                        .slice(0, 7)}
                    discussions={(homeFeed?.discussions || [])
                        .filter((item: any) => !dismissedIds.has(item.id))
                        .slice(0, 7)}
                    ratings={(homeFeed?.ratings || [])
                        .filter((item: any) => !dismissedIds.has(item.id.toString()))
                        .slice(0, 7)}
                    onDismiss={handleDismiss}
                  />
                );
              }
              if (item.type === 'blockB') {
                return (
                  <SecondContentBlock
                    key={`blockB-${index}`}
                    creators={(homeFeed?.connections || [])
                        .filter((item: any) => !dismissedIds.has(item.id))
                        .slice(0, 7)}
                    marketplace={(homeFeed?.marketplace || [])
                        .filter((item: any) => !dismissedIds.has(item.id))
                        .slice(0, 7)}
                    vendors={(homeFeed?.vendors || [])
                        .filter((item: any) => !dismissedIds.has(item.id))
                        .slice(0, 7)}
                    onConnect={(id) => sendConnectionRequest(id)}
                    onDismiss={handleDismiss}
                  />
                );
              }

              const post = item.data;
              if (!post) return null;

              const author = post.profiles;
              const authorName = author?.full_name || author?.username || 'Anonymous User';
              const authorRole = author?.craft || 'Creator';
              const getInitials = (name: string) => name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);

              return (
                <PostCard
                  key={`post-${post.id}`}
                  id={post.id}
                  author={{
                    id: author?.id,
                    name: authorName,
                    role: authorRole,
                    craft: author?.craft || undefined,
                    account_type: author?.account_type || undefined,
                    initials: getInitials(authorName),
                    avatar: author?.avatar_url || undefined,
                    isVerified: !!author?.is_verified
                  }}
                  timeAgo={(() => {
                    try {
                      const d = post.created_at ? new Date(post.created_at) : new Date();
                      return isNaN(d.getTime()) ? "Just now" : formatDistanceToNow(d, { addSuffix: true });
                    } catch {
                      return "Just now";
                    }
                  })()}
                  createdAt={post.created_at}
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
                  currentUserLiked={Array.isArray(likedPostIds) && likedPostIds.includes(post.id)}
                  onRate={onRate}
                  onLikeToggle={handleLikeToggle}
                  pageInfo={post.company_pages ? {
                    id: post.company_pages.id,
                    name: post.company_pages.name,
                    logo_url: post.company_pages.logo_url,
                    slug: post.company_pages.slug,
                    is_verified: !!post.company_pages.is_verified
                  } : undefined}
                  mediaUrl={post.media_urls?.[0] || post.media_url}
                  mediaItems={post.media_items || post.media_urls?.map((url: string) => ({ url, type: post.media_type || 'image' }))}
                  location={post.location || (post as any).media_items?.[0]?.location}
                  comments_disabled={post.comments_disabled || (post as any).media_items?.[0]?.comments_disabled}
                  hide_likes={post.hide_likes || (post as any).media_items?.[0]?.hide_likes}
                  tagged_users={post.tagged_users || (post as any).media_items?.[0]?.tagged_users}
                  authorId={post.author_id}
                  onDelete={(postId) => {
                    setLocalPosts(prev => prev.filter(p => p.id !== postId));
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>

      {/* Instagram-style Sidebar (Hidden on small screens) */}
      <aside className="hidden lg:flex flex-col w-[300px] gap-5 sticky top-20 h-fit">
        {/* User Mini Profile */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border border-border">
              <AvatarImage src={profile?.avatar_url || user?.user_metadata?.avatar_url} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                {(profile?.full_name || user?.email)?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-serif font-bold uppercase tracking-tight text-[11px] lg:text-[12px] text-foreground line-clamp-1">
                  {profile?.username || profile?.full_name || user?.email?.split('@')[0]}
                </span>
                {profile?.is_verified && <VerificationBadge size="xs" />}
              </div>
              <span className="text-[11px] text-muted-foreground">
                {profile?.craft || 'Personal Account'}
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setIsAccountSwitcherOpen(true)} className="text-primary text-[9px] font-black uppercase tracking-widest font-mono hover:bg-transparent">Switch</Button>
        </div>

        {/* Suggestions Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest font-mono">Suggestions for you</span>
            <Button variant="ghost" size="sm" className="text-foreground text-[9px] font-black uppercase tracking-widest font-mono hover:bg-transparent p-0 h-auto">See All</Button>
          </div>
          
          <div className="space-y-3 px-1">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-secondary/20 text-[10px]">TR</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-serif font-bold uppercase tracking-tight text-[10px] lg:text-[11px] leading-tight">tech_renaissance</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">Followed by art_daily + 2 more</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-primary text-[11px] font-semibold hover:bg-transparent p-0 h-auto">Follow</Button>
             </div>
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-secondary/20 text-[10px]">CD</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-serif font-bold uppercase tracking-tight text-[10px] lg:text-[11px] leading-tight">cine_director</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">Suggested for you</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-primary text-[11px] font-semibold hover:bg-transparent p-0 h-auto">Follow</Button>
             </div>
          </div>
        </div>

        {/* Footer Links */}
        <div className="px-2 pt-4">
          <p className="text-[11px] text-muted-foreground/50 leading-relaxed tracking-tight">
            About • Help • Press • API • Jobs • Privacy • Terms • Locations • Language • Meta Verified
          </p>
          <p className="text-[11px] text-muted-foreground/50 mt-4 uppercase tracking-widest font-medium">
            © 2026 CINECRAFT FROM VAMMSHIKRISHNA
          </p>
        </div>
      </aside>
      
      <AccountSwitcherSheet
        isOpen={isAccountSwitcherOpen}
        onOpenChange={setIsAccountSwitcherOpen}
      />
    </div>
  );
};

export default FeedTab;
