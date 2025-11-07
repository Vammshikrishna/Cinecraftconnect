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

const FollowingFeedTab = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showComments, setShowComments] = useState<{ [key: number]: boolean }>({});
  const { toast } = useToast();
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());
  const [likingPosts, setLikingPosts] = useState<Set<number>>(new Set());

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

  const handleLike = async (postId: number) => {
    if (likingPosts.has(postId)) return;

    let user;
    try {
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!data?.user) {
            toast({ title: "Authentication required", description: "You need to be logged in to like a post.", variant: "destructive" });
            return;
        }
        user = data.user;
    } catch (error: any) {
        console.error("Authentication error:", error);
        toast({ title: "Authentication failed", description: error.message || "Could not verify your session.", variant: "destructive" });
        return;
    }

    const isLiked = likedPosts.has(postId);
    const originalLikedPosts = new Set(likedPosts);

    setLikingPosts(prev => new Set(prev).add(postId));

    // Optimistic UI update
    setPosts(prevPosts =>
      prevPosts.map(post =>
        post.id === postId ? { ...post, likes: (post.likes || 0) + (isLiked ? -1 : 1) } : post
      )
    );
    setLikedPosts(prev => {
      const newSet = new Set(prev);
      if (isLiked) newSet.delete(postId);
      else newSet.add(postId);
      return newSet;
    });

    const { error: dbError } = isLiked
        ? await supabase.from('post_likes').delete().match({ post_id: postId, user_id: user.id })
        : await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });

    if (dbError) {
      // Rollback on error
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post.id === postId ? { ...post, likes: (post.likes || 0) + (isLiked ? 1 : -1) } : post
        )
      );
      setLikedPosts(originalLikedPosts);
      toast({ title: `Failed to ${isLiked ? 'unlike' : 'like'} post`, description: dbError.message, variant: "destructive" });
    }

    setLikingPosts(prev => {
      const newSet = new Set(prev);
      newSet.delete(postId);
      return newSet;
    });
  };

  const toggleComments = (postId: number) => {
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
                <AvatarImage src={post.author?.avatar} alt={post.author?.name} />
                <AvatarFallback>{post.author?.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{post.author?.name}</p>
                <p className="text-sm text-muted-foreground">{new Date(post.created_at).toLocaleTimeString()}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-4">{post.content}</p>
            <div className="flex items-center justify-between text-muted-foreground">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" className="flex items-center gap-2" onClick={() => handleLike(post.id)} disabled={likingPosts.has(post.id)}>
                  <ThumbsUp size={16} fill={likedPosts.has(post.id) ? 'currentColor' : 'none'} /> {post.likes || 0}
                </Button>
                <Button variant="ghost" size="sm" className="flex items-center gap-2" onClick={() => toggleComments(post.id)}>
                  <MessageCircle size={16} /> {post.comments_count || 0}
                </Button>
              </div>
              <ShareButton postId={post.id} />
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
