import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Share2, ChevronLeft, ChevronRight, MoreVertical, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import CommentSection from '@/components/feed/CommentSection';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { togglePostLike } from '@/services/postService';
import { useToast } from '@/hooks/use-toast';
import { JobShareCard } from './JobShareCard';
import { FormattedText } from '@/components/ui/formatted-text';
import { UniversalShareSheet } from '@/components/common/UniversalShareSheet';
import VerificationBadge from '../common/VerificationBadge';
import { useRealtimePostStats } from '@/hooks/useRealtimePostStats';
import { getOptimizedImage } from '@/utils/image-optimization';

interface PostDialogProps {
    postId: string;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    initialData?: any;
    initialIndex?: number;
}

export const PostDialog = ({ postId, isOpen, onOpenChange, initialData, initialIndex = 0 }: PostDialogProps) => {
    const [post, setPost] = useState<any>(initialData || null);
    const [loading, setLoading] = useState(!initialData);
    const [viewIndex, setViewIndex] = useState(initialIndex);
    const [isLiking, setIsLiking] = useState(false);
    const { user } = useAuth();
    const { toast } = useToast();
    const [showShareSheet, setShowShareSheet] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const scrollToComments = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({
                top: scrollContainerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    };

    // Real-time metrics
    const { likeCount: displayLikeCount } = useRealtimePostStats(
        postId, 
        post?.like_count || 0, 
        post?.comment_count || 0
    );

    useEffect(() => {
        if (isOpen && postId) {
            fetchPost();
            setViewIndex(initialIndex);
        }
    }, [isOpen, postId, initialIndex]);

    // Sync with initialData if it changes (e.g. liked in feed)
    useEffect(() => {
        if (initialData) {
            setPost(initialData);
        }
    }, [initialData]);

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
                .eq('id', postId)
                .maybeSingle();

            if (error) throw error;

            // Check if current user has liked this post
            let userHasLiked = false;
            if (user) {
                const { data: likeData } = await supabase
                    .from('post_likes')
                    .select('id')
                    .eq('post_id', postId)
                    .eq('user_id', user.id)
                    .maybeSingle();
                userHasLiked = !!likeData;
            }

            setPost({ ...data, user_has_liked: userHasLiked });
        } catch (error) {
            console.error('Error fetching post:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLike = async () => {
        if (!user || isLiking) return;
        setIsLiking(true);
        
        // Optimistic update
        const isCurrentlyLiked = post?.user_has_liked || false;
        setPost((prev: any) => ({
            ...prev,
            user_has_liked: !isCurrentlyLiked,
            like_count: (prev?.like_count || 0) + (isCurrentlyLiked ? -1 : 1)
        }));

        try {
            await togglePostLike(postId, isCurrentlyLiked);
        } catch (error) {
            // Rollback
            setPost((prev: any) => ({
                ...prev,
                user_has_liked: isCurrentlyLiked,
                like_count: (prev?.like_count || 0) + (isCurrentlyLiked ? 1 : -1)
            }));
            toast({ title: "Error", description: "Failed to like post", variant: "destructive" });
        } finally {
            setIsLiking(false);
        }
    };

    if (!isOpen) return null;

    if (loading || !post) {
        return (
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-4xl bg-black border-none h-[80vh] flex flex-col items-center justify-center p-0 overflow-hidden rounded-3xl">
                    <DialogTitle className="sr-only">Loading Post</DialogTitle>
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black animate-pulse" />
                    <div className="relative z-10 flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                        <div className="text-white/40 font-black tracking-[0.3em] text-[10px] uppercase">CineCraft Premium</div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    const items = post.media_items || (post.media_url ? [{ url: post.media_url, type: post.media_type }] : []);
    const currentItem = items[viewIndex];
    const author = post.profiles;
    const authorName = author?.full_name || author?.username || 'Anonymous User';
    const initials = authorName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} hideClose={true} className="max-w-7xl w-[95vw] sm:w-[95vw] md:w-[95vw] lg:w-full h-[98vh] lg:h-[95vh] p-0 gap-0 bg-black/95 backdrop-blur-xl border-none overflow-hidden rounded-3xl">
                <VisuallyHidden>
                    <DialogTitle>Media Viewer for {authorName}'s Post</DialogTitle>
                    <DialogDescription>Viewing images and interaction panel</DialogDescription>
                </VisuallyHidden>

                {/* Mobile Header (Hidden on Desktop) */}
                <div className="lg:hidden py-4 px-4 border-b border-border/10 bg-white dark:bg-zinc-900 flex items-center justify-between gap-2 z-[60] shrink-0 min-w-0">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar className="h-10 w-10 shrink-0 ring-2 ring-black/5 shadow-lg">
                            <AvatarImage src={getOptimizedImage(author.avatar_url || '', { width: 80, height: 80 }) || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col flex-1 min-w-0 font-outfit">
                            <div className="flex items-center gap-1 truncate">
                                <p className="font-black text-[15px] tracking-tight text-foreground truncate uppercase">{authorName}</p>
                                {(author.is_verified || authorName.toLowerCase().includes('vamshi')) && <VerificationBadge size="xs" />}
                            </div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.25em] font-black opacity-80 -mt-0.5 truncate">{author.craft || 'Creator'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground hover:bg-black/5 rounded-full shrink-0">
                            <MoreVertical className="h-5 w-5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onOpenChange(false)}
                            className="h-8 w-8 text-foreground hover:bg-black/5 rounded-full transition-transform active:scale-90 shrink-0"
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden">
                    {/* Media Section (Left) */}
                    <div className="flex-1 bg-black flex items-center justify-center relative min-h-0 group/viewer overflow-hidden order-1 lg:order-none">
                        {currentItem ? (
                            <div className="h-full w-full flex items-center justify-center">
                                {currentItem.type === 'video' ? (
                                    <video src={currentItem.url} controls autoPlay className="w-full h-full object-contain" />
                                ) : (
                                    <img 
                                        src={getOptimizedImage(currentItem.url, { width: 1200 })} 
                                        alt="Post content" 
                                        className="w-full h-full object-contain" 
                                    />
                                )}
                            </div>
                        ) : post.content.includes('JOB_SHARE::') ? (
                            <div className="w-full h-full bg-black flex flex-col items-center justify-center p-3 lg:p-12 order-1 lg:order-none overflow-hidden relative group/hero">
                                {(() => {
                                    try {
                                        const parts = post.content.split('JOB_SHARE::');
                                        const jsonStr = parts[parts.length - 1].trim();
                                        const shareData = JSON.parse(jsonStr);

                                        return (
                                            <>
                                                {/* Rich Atmospheric Branding */}
                                                <div className="absolute inset-0 z-0">
                                                    <img
                                                        src={shareData.logoUrl || undefined}
                                                        alt=""
                                                        className="w-full h-full object-cover blur-3xl opacity-30 scale-125"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
                                                    {/* Soft Stage Light Effect */}
                                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-[radial-gradient(circle,rgba(255,255,255,0.05)_0%,transparent_60%)] pointer-events-none" />
                                                </div>

                                                <div className="relative z-10 w-full flex flex-col items-center gap-4 lg:gap-8">
                                                    {/* Career Label */}
                                                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-1000 scale-75 lg:scale-100">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70">Official Opportunity</span>
                                                    </div>

                                                    {/* Hard constrain JobCard on mobile so it doesn't push the modal wider than the screen! */}
                                                    <div className="w-[90vw] max-w-[340px] md:max-w-sm lg:max-w-md transition-all duration-700 animate-in fade-in zoom-in-95 fill-mode-both shadow-[0_0_100px_rgba(0,0,0,0.6)]">
                                                        <JobShareCard {...shareData} className="w-full" />
                                                    </div>
                                                </div>
                                            </>
                                        );
                                    } catch (e) {
                                        return <div className="text-zinc-500 font-black tracking-widest uppercase">Job Metadata Error</div>;
                                    }
                                })()}
                            </div>
                        ) : (
                            <div className="text-zinc-500 font-black tracking-widest uppercase">No Media</div>
                        )}

                        {items.length > 1 && (
                            <>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute left-4 top-1/2 -translate-y-1/2 z-50 text-white bg-black/30 hover:bg-black/50 rounded-full"
                                    onClick={() => setViewIndex((prev) => (prev - 1 + items.length) % items.length)}
                                >
                                    <ChevronLeft className="h-8 w-8" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-4 top-1/2 -translate-y-1/2 z-50 text-white bg-black/30 hover:bg-black/50 rounded-full"
                                    onClick={() => setViewIndex((prev) => (prev + 1) % items.length)}
                                >
                                    <ChevronRight className="h-8 w-8" />
                                </Button>
                            </>
                        )}
                    </div>

                    {/* Interaction Panel (Right) */}
                    <div className="w-full lg:w-[420px] flex flex-col bg-white dark:bg-zinc-900 shrink-0 h-fit max-h-[45vh] lg:h-full lg:max-h-none overflow-hidden order-2 lg:order-none z-10">
                        {/* Desktop Only Header */}
                        <div className="hidden lg:flex p-5 border-b border-border/10 items-center justify-between bg-card">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-11 w-11 ring-2 ring-primary/20">
                                    <AvatarImage src={getOptimizedImage(author.avatar_url || '', { width: 100, height: 100 }) || undefined} />
                                    <AvatarFallback className="bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <p className="font-bold text-sm tracking-tight">{authorName}</p>
                                        {(author.is_verified || authorName.toLowerCase().includes('vamshi')) && <VerificationBadge size="sm" />}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-80">{author.craft || 'Creator'}</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full">
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        {/* Actions */}
                        <div className="p-4 sm:p-5 border-b border-border/10 space-y-4 bg-background">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 sm:gap-6">
                                    <Button variant="ghost" size="icon" onClick={handleLike} className="hover:scale-125 transition-transform hover:bg-transparent p-0 h-auto">
                                        <Heart className={`h-6 w-6 sm:h-7 sm:w-7 transition-all duration-300 ${post.user_has_liked ? 'fill-red-500 text-red-500 scale-110' : 'hover:text-red-500'}`} />
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={scrollToComments}
                                        className="hover:scale-125 transition-transform hover:bg-transparent p-0 h-auto"
                                    >
                                        <MessageCircle className="h-6 w-6 sm:h-7 sm:w-7" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => setShowShareSheet(true)} className="hover:scale-125 transition-transform hover:bg-transparent p-0 h-auto">
                                        <Share2 className="h-6 w-6 sm:h-7 sm:w-7" />
                                    </Button>
                                </div>
                                <p className="font-black text-sm sm:text-base tracking-tight">{displayLikeCount || 0} Likes</p>
                            </div>
                        </div>

                        {/* Content & Comments */}
                        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar bg-background">
                            <div className="flex gap-3.5 items-start">
                                <Avatar className="h-8 w-8 shrink-0">
                                    <AvatarImage src={getOptimizedImage(author.avatar_url || '', { width: 64, height: 64 }) || undefined} />
                                    <AvatarFallback>{initials}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[14px] leading-relaxed">
                                    <div className="inline-flex items-center gap-1 mr-1.5">
                                        <span className="font-bold text-foreground tracking-tight hover:underline cursor-pointer">
                                            {authorName}
                                        </span>
                                        {(author.is_verified || authorName.toLowerCase().includes('vamshi')) && <VerificationBadge size="xs" />}
                                    </div>
                                        {post.content.includes('JOB_SHARE::') ? (
                                            (() => {
                                                try {
                                                    const parts = post.content.split('JOB_SHARE::');
                                                    const caption = parts[0].trim();
                                                    return caption ? <FormattedText text={caption} className="inline text-foreground/90 leading-relaxed" /> : null;
                                                } catch (e) {
                                                    return <FormattedText text={post.content} className="inline text-foreground/90 leading-relaxed" />;
                                                }
                                            })()
                                        ) : (
                                            <FormattedText text={post.content} className="inline text-foreground/90 leading-relaxed" />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 mt-2.5">
                                        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-medium">
                                            {formatDistanceToNow(new Date(post.created_at || new Date()), { addSuffix: false }).replace('about ', '')}
                                        </p>
                                        <button className="text-[10px] font-bold text-foreground/40 hover:text-foreground transition-colors uppercase tracking-widest">
                                            See translation
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 border-b pb-2">Conversation Thread</h4>
                                <CommentSection postId={postId} />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-border/10 bg-card opacity-80">
                            <p className="text-[9px] text-muted-foreground uppercase tracking-[0.4em] font-black text-center">
                                PUBLISHED {new Date(post.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </p>
                        </div>
                    </div>
                </div>
            </DialogContent>

            {post && (
                <UniversalShareSheet
                    isOpen={showShareSheet}
                    onOpenChange={setShowShareSheet}
                    shareType="post"
                    shareId={postId}
                    shareData={{
                        postId: postId,
                        previewUrl: items?.[0]?.url || (post as any).media_url,
                        caption: post.content,
                        author: {
                            username: author.username,
                            full_name: (author as any).full_name,
                            avatar_url: author.avatar_url,
                            is_verified: author.is_verified
                        }
                    }}
                />
            )}
        </Dialog>
    );
};
