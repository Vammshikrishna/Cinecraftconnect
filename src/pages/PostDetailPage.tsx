import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import PostCard from '@/components/feed/PostCard';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatDistanceToNow } from 'date-fns';

const PostDetailPage = () => {
    const { postId } = useParams<{ postId: string }>();
    const navigate = useNavigate();
    const [post, setPost] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (postId) {
            fetchPost();
        }
    }, [postId]);

    const fetchPost = async () => {
        setLoading(true);
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
                        craft
                    )
                `)
                .eq('id', postId || '')
                .single();

            if (error) throw error;
            setPost(data);
        } catch (error) {
            console.error('Error fetching post:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    if (!post) {
        return (
            <div className="flex flex-col h-screen items-center justify-center bg-background text-center gap-4">
                <h2 className="text-2xl font-bold">Post Not Found</h2>
                <Button onClick={() => navigate(-1)} variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                </Button>
            </div>
        );
    }

    const author = post.profiles;
    const authorName = author?.full_name || author?.username || 'Anonymous User';
    const initials = authorName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

    return (
        <div className="min-h-screen bg-background pt-20">
            <div className="container mx-auto px-4 pb-24 max-w-2xl">
                <Button
                    variant="ghost"
                    onClick={() => navigate(-1)}
                    className="mb-6 pl-0 hover:bg-transparent hover:text-primary transition-colors"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Feed
                </Button>

                <PostCard
                    id={post.id}
                    author={{
                        id: post.author_id,
                        name: authorName,
                        role: author?.craft || 'Creator',
                        craft: author?.craft,
                        initials: initials,
                        avatar: author?.avatar_url
                    }}
                    timeAgo={formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                    content={post.content}
                    hasImage={post.media_type === 'image'}
                    hasVideo={post.media_type === 'video'}
                    mediaUrl={post.media_url}
                    mediaItems={post.media_items}
                    like_count={post.like_count || 0}
                    comment_count={post.comment_count || 0}
                    share_count={post.share_count || 0}
                    createdAt={post.created_at}
                    tags={post.tags}
                    onDelete={() => navigate(-1)}
                />
            </div>
        </div>
    );
};

export default PostDetailPage;
