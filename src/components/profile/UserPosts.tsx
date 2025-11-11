
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Post {
  id: string;
  content: string;
  media_url?: string;
  media_type?: string;
}

interface UserPostsProps {
  targetUserId: string;
}

export const UserPosts = ({ targetUserId }: UserPostsProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!targetUserId) return;

    const fetchPosts = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('posts')
        .select('id, content, media_url, media_type')
        .eq('author_id', targetUserId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setPosts(data as any);
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
  }, [targetUserId]);

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
    <div className="space-y-4">
      {posts.map((post) => (
        <Card key={post.id} className="bg-gray-900 border-gray-800 rounded-lg">
          <CardContent className="p-4">
            {post.content && <p className="text-gray-300 mb-4">{post.content}</p>}
            
            {post.media_url && (
              <div className="rounded-lg overflow-hidden">
                {post.media_type?.startsWith('image') ? (
                  <img 
                    src={post.media_url} 
                    alt="Post media" 
                    className="w-full h-auto object-contain"
                  />
                ) : post.media_type?.startsWith('video') ? (
                  <video 
                    src={post.media_url} 
                    controls
                    className="w-full h-auto rounded-lg"
                  />
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
