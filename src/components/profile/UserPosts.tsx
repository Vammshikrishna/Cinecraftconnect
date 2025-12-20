import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { Post } from '@/types';

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
  const { user } = useAuth();

  useEffect(() => {
    if (!targetUserId) return;

    const fetchPosts = async () => {
      setLoading(true);

      // Fetch posts
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
          fetchPosts(); // Refetch to keep it simple
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [targetUserId, user]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4">
            <Skeleton className="h-4 w-3/4 mb-4" />
            <Skeleton className="aspect-video w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No posts to display.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1 md:gap-4">
      {posts.map((post) => {
        const hasMedia = !!post.media_url;
        const isVideo = post.media_type === 'video';

        return (
          <div
            key={post.id}
            className="group relative aspect-square bg-muted overflow-hidden cursor-pointer"
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
                  alt="Post thumbnail"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              )
            ) : (
              <div className="w-full h-full p-4 flex items-center justify-center bg-secondary/30 text-center">
                <p className="text-xs md:text-sm text-muted-foreground line-clamp-5">
                  {post.content}
                </p>
              </div>
            )}

            {/* Video Indicator */}
            {isVideo && (
              <div className="absolute top-2 right-2 text-white drop-shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 md:w-6 md:h-6">
                  <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                </svg>
              </div>
            )}

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-4 md:gap-8">
              <div className="flex items-center gap-1 text-white">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 md:w-6 md:h-6">
                  <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.691 2.25 5.353 4.814 3.25 8.057 3.25c1.216 0 2.406.467 3.323 1.247 1.022-.762 2.387-1.417 3.793-1.417 3.106 0 5.8 2.15 5.8 5.4 0 3.308-2.65 5.768-5.748 8.16a25.2 25.2 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                </svg>
                <span className="font-bold text-sm md:text-base">{post.like_count || 0}</span>
              </div>
              <div className="flex items-center gap-1 text-white">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 md:w-6 md:h-6 mirror-y">
                  <path fillRule="evenodd" d="M4.804 21.644A6.707 6.707 0 006 21.75a6.721 6.721 0 003.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.701 6.162.477.448.595 1.096.388 1.63L4.804 21.644z" clipRule="evenodd" transform="scale(-1, 1) translate(-24, 0)" />
                </svg>
                <span className="font-bold text-sm md:text-base">{post.comment_count || 0}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
