import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { supabase } from '@/integrations/supabase/client';
import { BackButton } from '@/components/common/BackButton';
import PostCard from '@/components/feed/PostCard';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatDistanceToNow } from 'date-fns';

const PostDetailPage = () => {
    const { postId } = useParams<{ postId: string }>();
    const { goBack, history } = useAppNavigation();
    const location = useLocation();
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
                        craft,
                        is_verified
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
                <BackButton />
            </div>
        );
    }

    const author = post.profiles;
    const authorName = author?.full_name || author?.username || 'Anonymous User';
    const initials = authorName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

    let backLabel = "BACK TO FEED";
    const fromState = location.state?.from;

    if (fromState === 'profile') {
        backLabel = "BACK TO PROFILE";
    } else if (fromState === 'explore') {
        backLabel = "BACK TO EXPLORE";
    } else if (history.length > 1) {
        const prevPath = history[history.length - 2];
        if (prevPath.includes('/profile/')) backLabel = "BACK TO PROFILE";
        else if (prevPath.includes('/pages/')) backLabel = "BACK TO PAGE";
        else if (prevPath.includes('/explore') || prevPath.includes('/search')) backLabel = "BACK TO EXPLORE";
    }

    return (
        <div className="min-h-screen bg-background pt-20">
            <div className="container mx-auto px-4 pb-24 max-w-2xl">
                <BackButton label={backLabel} className="mb-6" />

                <PostCard
                    id={post.id}
                    author={{
                        id: post.author_id,
                        name: authorName,
                        role: author?.craft || 'Creator',
                        craft: author?.craft,
                        initials: initials,
                        avatar: author?.avatar_url,
                        isVerified: author?.is_verified
                    }}
                    timeAgo={formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                    content={post.content}
                    hasImage={post.media_type === 'image' || (post.media_urls && post.media_urls.length > 0)}
                    hasVideo={post.media_type === 'video'}
                    mediaUrl={post.media_urls?.[0] || post.media_url}
                    mediaItems={post.media_urls?.map((url: string) => ({ url, type: post.media_type || 'image' })) || post.media_items}
                    like_count={post.like_count || 0}
                    comment_count={post.comment_count || 0}
                    share_count={post.share_count || 0}
                    createdAt={post.created_at}
                    tags={post.tags}
                    onDelete={() => goBack()}
                />
            </div>
        </div>
    );
};

export default PostDetailPage;
