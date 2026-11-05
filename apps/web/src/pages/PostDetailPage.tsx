import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BackButton } from '@/components/common/BackButton';
import PostCard from '@/components/feed/PostCard';
import { formatDistanceToNow } from 'date-fns';
import { LoadError } from '@/components/settings/LoadError';
import { ScreenSkeleton } from '@/components/ui/enhanced-skeleton';

const PostDetailPage = () => {
    const { postId } = useParams<{ postId: string }>();
    const { goBack, history } = useAppNavigation();
    const location = useLocation();
    const [post, setPost] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const { user } = useAuth();
    // whether the signed-in person already liked this post (the card shows a filled heart and unlikes on the next tap)
    const [liked, setLiked] = useState(false);

    useEffect(() => {
        if (postId) {
            fetchPost();
        }
    }, [postId]);

    const fetchPost = async () => {
        setLoading(true);
        setLoadFailed(false);
        try {
            const { data, error } = await supabase
                .from('posts')
                .select(`
                    *,
                    profiles:author_id (
                        id,
                        full_name,
                        username,
                        avatar_url,
                        craft,
                        is_verified
                    )
                `)
                .eq('id', postId || '')
                .maybeSingle();

            if (error) throw error;
            setPost(data);
            if (data && user?.id) {
                const { data: mine } = await supabase.from('post_likes').select('post_id').eq('post_id', data.id).eq('user_id', user.id).maybeSingle();
                setLiked(!!mine);
            } else {
                setLiked(false);
            }
        } catch (error) {
            console.error('Error fetching post:', error);
            setPost(null);
            setLoadFailed(true);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <ScreenSkeleton variant="detail" />;

    if (!post && loadFailed) {
        return (
            <div className="flex flex-col h-dvh items-center justify-center bg-background px-4 gap-4">
                <LoadError title="Could not load this post" onRetry={fetchPost} />
                <BackButton />
            </div>
        );
    }

    if (!post) {
        return (
            <div className="flex flex-col h-dvh items-center justify-center bg-background text-center gap-4">
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
        <div className="min-h-dvh bg-background pt-16 sm:pt-20">
            <div className="container mx-auto px-2 sm:px-4 pb-24 max-w-[760px]">
                <BackButton label={backLabel} className="mb-4" />

                <PostCard
                    id={post.id}
                    has_poll={!!(post as any).has_poll}
                    scheduled_at={(post as any).scheduled_at}
                    has_collabs={!!(post as any).has_collabs}
                    link_preview={(post as any).link_preview}
                    audience={(post as any).audience}
                    edited_at={(post as any).edited_at}
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
                    mediaItems={post.media_items && Array.isArray(post.media_items) && post.media_items.length > 0 ? post.media_items : (post.media_urls?.map((url: string) => ({ url, type: post.media_type || 'image' })))}
                    currentUserLiked={liked}
                    onLikeToggle={(_id: string, v: boolean) => setLiked(v)}
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
