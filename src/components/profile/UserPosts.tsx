import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Post } from '@/types';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import PostCard from '@/components/feed/PostCard';
import { Grid3x3, ChevronLeft, Layers, Play, Pin } from 'lucide-react';
import { getOptimizedImage } from '@/utils/image-optimization';
import { CachedImage } from '@/components/common/CachedImage';
import { CachedVideo } from '@/components/common/CachedVideo';

interface UserPostsProps {
  targetUserId: string;
  isOwner?: boolean;
}

interface ExtendedPost extends Omit<Post, 'media_url' | 'media_urls' | 'media_items' | 'media_type' | 'has_ai_generated' | 'page_id' | 'tags' | 'comment_count' | 'like_count' | 'share_count'> {
  is_pinned?: boolean;
  media_url?: string | null;
  media_urls?: string[] | null;
  media_items?: any | null;
  media_type?: string | null;
  has_ai_generated?: boolean | null;
  page_id?: string | null;
  tags?: string[] | null;
  comment_count?: number | null;
  like_count?: number | null;
  share_count?: number | null;
  profiles: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    craft: string | null;
    is_verified: boolean | null;
  };
}

export const UserPosts = ({ targetUserId, isOwner }: UserPostsProps) => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<ExtendedPost[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'feed'>('grid');
  const [loading, setLoading] = useState(true);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (viewMode === 'feed' && selectedPostId) {
      let adjustTimer: ReturnType<typeof setTimeout>;
      
      const timer = setTimeout(() => {
        const el = document.getElementById(`feed-post-${selectedPostId}`);
        if (el) {
          // Scroll instantly first so the page is immediately positioned near the post
          el.scrollIntoView({ behavior: 'auto', block: 'start' });
          window.scrollBy(0, -80);

          // Smoothly adjust position after another short delay to account for any layout shifts/image loading
          adjustTimer = setTimeout(() => {
            const elUpdated = document.getElementById(`feed-post-${selectedPostId}`);
            if (elUpdated) {
              const y = elUpdated.getBoundingClientRect().top + window.scrollY - 80;
              window.scrollTo({ top: y, behavior: 'smooth' });
            }
          }, 150);
        }
      }, 100);

      return () => {
        clearTimeout(timer);
        if (adjustTimer) clearTimeout(adjustTimer);
      };
    }
  }, [viewMode, selectedPostId]);

  useEffect(() => {
    fetchPosts();
  }, [targetUserId]);

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles (
            id,
            full_name,
            username,
            avatar_url,
            craft,
            is_verified
          )
        `)
        .eq('author_id', targetUserId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error fetching user posts:', error);
    } finally {
      setLoading(false);
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
      {viewMode === 'feed' ? (
        <div className="max-w-2xl mx-auto py-4">
          <Button variant="ghost" onClick={() => setViewMode('grid')} className="mb-6 font-black uppercase tracking-widest text-[10px] text-muted-foreground hover:text-foreground sticky top-[72px] z-10 bg-background/80 backdrop-blur-md">
            <ChevronLeft className="mr-1 h-3 w-3" /> Back to Grid
          </Button>
          <div className="space-y-8">
            {posts.map(post => (
              <div key={post.id} id={`feed-post-${post.id}`}>
                <PostCard
                  id={post.id}
                  author={{
                    id: post.profiles.id,
                    name: post.profiles.full_name || post.profiles.username || 'Unknown',
                    role: post.profiles.craft || 'Creator',
                    craft: post.profiles.craft || undefined,
                    initials: (post.profiles.full_name || post.profiles.username || 'U').substring(0, 2).toUpperCase(),
                    avatar: post.profiles.avatar_url || undefined,
                    isVerified: post.profiles.is_verified || false
                  }}
                  timeAgo={formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  content={post.content}
                  hasImage={post.media_type === 'image' || (post.media_urls && post.media_urls.length > 0) || false}
                  hasVideo={post.media_type === 'video' || false}
                  mediaUrl={post.media_urls?.[0] || post.media_url || undefined}
                  mediaItems={post.media_items || post.media_urls?.map((url: string) => ({ url, type: (post.media_type === 'video' ? 'video' : 'image') }))}
                  like_count={post.like_count || 0}
                  comment_count={post.comment_count || 0}
                  share_count={post.share_count || 0}
                  createdAt={post.created_at}
                  tags={post.tags || undefined}
                  authorId={post.author_id}
                  onDelete={() => {
                    setPosts(posts.filter(p => p.id !== post.id));
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1 md:gap-2">
          {posts.map((post) => {
            const effectiveMediaItems = post.media_urls?.map((url: string) => ({ url, type: post.media_type || 'image' })) || post.media_items || [];
            const effectiveMediaUrl = post.media_urls?.[0] || post.media_url;
            const hasMedia = !!effectiveMediaUrl || effectiveMediaItems.length > 0;
            const isVideo = post.media_type === 'video' || (effectiveMediaItems.length > 0 && effectiveMediaItems[0].type === 'video');
            const isMulti = effectiveMediaItems.length > 1;

            return (
              <div
                key={post.id}
                onClick={() => navigate(`/post/${post.id}`, { state: { from: 'profile' } })}
                className="group relative aspect-square bg-muted overflow-hidden cursor-pointer rounded-none md:rounded-sm"
              >
              {hasMedia ? (
                isVideo ? (
                  <CachedVideo
                    src={effectiveMediaItems.length > 0 ? effectiveMediaItems[0].url : effectiveMediaUrl}
                    className="w-full h-full object-cover"
                    preload="none"
                  />
                ) : (
                  <CachedImage
                    src={getOptimizedImage(effectiveMediaItems.length > 0 ? effectiveMediaItems[0].url : effectiveMediaUrl, { width: 400, height: 400 })}
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
                      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.03),transparent)] pointer-events-none" />
                      <p className="text-sm md:text-base font-black tracking-tight text-foreground leading-[1.2] text-center line-clamp-5 drop-shadow-sm uppercase">
                        {post.content.split('JOB_SHARE::')[0].split('POST_SHARE::')[0].trim()}
                      </p>
                    </div>
                  )}
                  <div className="absolute inset-0 border border-white/5 pointer-events-none rounded-none md:rounded-sm" />
                </div>
              )}

              {isMulti && (
                <div className="absolute top-2 right-2 text-white drop-shadow-lg z-10">
                  <Layers className="w-4 h-4 md:w-5 md:h-5" />
                </div>
              )}

              {!isMulti && isVideo && (
                <div className="absolute top-2 right-2 text-white drop-shadow-lg z-10">
                  <Play className="w-4 h-4 md:w-5 md:h-5 fill-current" />
                </div>
              )}

              {post.is_pinned && (
                <div className="absolute top-2 left-2 text-white drop-shadow-lg z-10 bg-primary/90 p-1.5 rounded-full backdrop-blur-sm">
                  <Pin className="w-3 h-3 fill-current text-white rotate-45" />
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </>
  );
};