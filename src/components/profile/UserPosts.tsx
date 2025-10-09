import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Post {
  id: string;
  content: string;
  media_url?: string;
  media_type?: string;
  created_at: string;
  author_id: string;
  like_count: number;
  comment_count: number;
  tags?: string[];
}

interface UserPostsProps {
  userId?: string;
}

export const UserPosts = ({ userId }: UserPostsProps) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (!targetUserId) return;

    const fetchPosts = async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('author_id', targetUserId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setPosts(data);
      }
      setLoading(false);
    };

    fetchPosts();

    // Real-time subscription
    const channel = supabase
      .channel('user-posts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
          filter: `author_id=eq.${targetUserId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setPosts(prev => [payload.new as Post, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setPosts(prev => prev.map(p => p.id === payload.new.id ? payload.new as Post : p));
          } else if (payload.eventType === 'DELETE') {
            setPosts(prev => prev.filter(p => p.id !== payload.old.id));
          }
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
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No posts yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <Card key={post.id}>
          <CardContent className="pt-6">
            <p className="text-sm mb-4">{post.content}</p>
            
            {post.media_url && (
              <div className="mb-4 rounded-lg overflow-hidden">
                {post.media_type === 'image' ? (
                  <img 
                    src={post.media_url} 
                    alt="Post content" 
                    className="w-full h-auto"
                  />
                ) : post.media_type === 'video' ? (
                  <video 
                    src={post.media_url} 
                    controls 
                    className="w-full h-auto"
                  />
                ) : null}
              </div>
            )}

            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {post.tags.map((tag, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4" />
                {post.like_count}
              </div>
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                {post.comment_count}
              </div>
              <span className="ml-auto text-xs">
                {new Date(post.created_at).toLocaleDateString()}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
