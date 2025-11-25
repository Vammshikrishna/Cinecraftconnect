import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import PostCard from '@/components/feed/PostCard';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
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
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());

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

      // Fetch liked posts for the current user
      if (user) {
        const { data: likesData } = await supabase
          .from('post_likes' as any)
          .select('post_id')
          .eq('user_id', user.id);

        if (likesData) {
          setLikedPostIds(new Set((likesData as any[]).map(l => l.post_id)));
        }
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
    <div className="space-y-6">
      {posts.map((post) => {
        const author = post.profiles;
        const authorName = author?.full_name || author?.username || 'Anonymous User';
        const authorRole = author?.craft || 'Creator';
        const getInitials = (name: string) =>
          name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);

        return (
          <PostCard
            key={post.id}
            id={post.id}
            author={{
              id: post.author_id,
              name: authorName,
              role: authorRole,
              initials: getInitials(authorName),
              avatar: author?.avatar_url || undefined
            }}
            timeAgo={formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            content={post.content}
            mediaUrl={post.media_url}
            hasImage={post.media_type === 'image'}
            hasVideo={post.media_type === 'video'}
            like_count={post.like_count}
            comment_count={post.comment_count}
            share_count={post.share_count}
            currentUserLiked={likedPostIds.has(post.id)}
          />
        );
      })}
    </div>
  );
};
