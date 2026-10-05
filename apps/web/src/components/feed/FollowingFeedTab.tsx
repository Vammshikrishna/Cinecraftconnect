import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageCircle, ThumbsUp } from 'lucide-react';
import ShareButton from '@/components/ShareButton';
import { Post } from '@/types';
import Spinner from '@/components/Spinner';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import CommentSection from './CommentSection';
import { useLikeMutation } from '@/hooks/mutations/useLikeMutation';
const FollowingFeedTab = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showComments, setShowComments] = useState<{ [key: string]: boolean }>({});
  const { toast } = useToast();
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const { toggleLike } = useLikeMutation();

  useEffect(() => {
    const abortController = new AbortController();
    const { signal } = abortController;

    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();

        const response = await fetch('/api/following/posts', { signal });
        if (!response.ok) {
          throw new Error('Failed to fetch posts from followed users.');
        }
        const data: Post[] = await response.json();
        setPosts(data);

        if (user && data.length > 0) {
          const postIds = data.map(p => p.id);
          const { data: likedPostData, error: likesError } = await supabase
            .from('post_likes')
            .select('post_id')
            .eq('user_id', user.id)
            .in('post_id', postIds);

          if (likesError) {
            toast({ title: "Error fetching likes", description: likesError.message, variant: "destructive" });
          } else {
            setLikedPosts(new Set(likedPostData.map(like => like.post_id)));
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    return () => {
      abortController.abort();
    };
  }, [toast]);

  const handleLike = async (postId: string) => {
    const isLiked = likedPosts.has(postId);
    await toggleLike(postId, isLiked);
  };

  const toggleComments = (postId: string) => {
    setShowComments(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  if (loading) {
    return <div className="flex justify-center items-center h-40"><Spinner /></div>;
  }

  if (error) {
    return <div className="text-red-500 text-center">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {posts.map(post => (
        <Card key={post.id}>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar>
                <AvatarImage src={post.profiles?.avatar_url || ''} alt={post.profiles?.full_name || post.profiles?.username || ''} />
                <AvatarFallback>{(post.profiles?.full_name || post.profiles?.username || 'U').charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{post.profiles?.full_name || post.profiles?.username}</p>
                <p className="text-sm text-muted-foreground">{new Date(post.created_at).toLocaleTimeString()}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-4">{post.content}</p>
            <div className="flex items-center justify-between text-muted-foreground">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" className="flex items-center gap-2" onClick={() => handleLike(post.id)}>
                  <ThumbsUp size={16} fill={likedPosts.has(post.id) ? 'currentColor' : 'none'} /> {post.like_count || 0}
                </Button>
                <Button variant="ghost" size="sm" className="flex items-center gap-2" onClick={() => toggleComments(post.id)}>
                  <MessageCircle size={16} /> {post.comment_count || 0}
                </Button>
              </div>
              <ShareButton postId={post.id} shareCount={post.share_count || 0} author={post.profiles as any} />
            </div>
            {showComments[post.id] && (
              <div className="mt-4">
                <CommentSection postId={post.id} />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default FollowingFeedTab;
