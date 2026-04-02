import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
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

interface PostDialogProps {
    postId: string;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export const PostDialog = ({ postId, isOpen, onOpenChange }: PostDialogProps) => {
    const [post, setPost] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [viewIndex, setViewIndex] = useState(0);
    const [isLiking, setIsLiking] = useState(false);
    const { user } = useAuth();
    const { toast } = useToast();

    useEffect(() => {
        if (isOpen && postId) {
            fetchPost();
        }
    }, [isOpen, postId]);

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
                .eq('id', postId)
                .single();

            if (error) throw error;
            setPost(data);
        } catch (error) {
            console.error('Error fetching post:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLike = async () => {
        if (!user || isLiking) return;
        setIsLiking(true);
        try {
            const isCurrentlyLiked = false; // We should probably fetch this, but for now...
            await togglePostLike(postId, isCurrentlyLiked);
            // Refresh post data to show new count
            fetchPost();
        } catch (error) {
            toast({ title: "Error", description: "Failed to like post", variant: "destructive" });
        } finally {
            setIsLiking(false);
        }
    };

    if (!isOpen) return null;

    if (loading || !post) {
        return (
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-4xl bg-black/90 backdrop-blur-xl border-none h-[80vh] flex items-center justify-center">
                    <DialogTitle className="sr-only">Loading Post</DialogTitle>
                    <div className="text-white animate-pulse">Loading Premium Post...</div>
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
            <DialogContent className="max-w-7xl w-full h-[95vh] lg:w-[95vw] lg:h-[95vh] p-0 gap-0 bg-black/95 backdrop-blur-xl border-none overflow-hidden rounded-3xl z-[9999]">
                <VisuallyHidden>
                    <DialogTitle>Media Viewer for {authorName}'s Post</DialogTitle>
                    <DialogDescription>Viewing images and interaction panel</DialogDescription>
                </VisuallyHidden>

                <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden">
                    {/* Media Section (Left) */}
                    <div className="flex-1 bg-black flex items-center justify-center relative min-h-0 group/viewer overflow-hidden order-1 lg:order-none">
                        <div className="h-full w-full flex items-center justify-center">
                            {currentItem?.type === 'video' ? (
                                <video src={currentItem.url} controls autoPlay className="w-full h-full object-contain" />
                            ) : (
                                <img src={currentItem?.url} alt="Post content" className="w-full h-full object-contain" />
                            )}
                        </div>

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
                        {/* Header */}
                        <div className="p-5 border-b border-border/10 flex items-center justify-between bg-card">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-11 w-11 ring-2 ring-primary/20">
                                    <AvatarImage src={author.avatar_url || undefined} />
                                    <AvatarFallback className="bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-bold text-sm tracking-tight">{authorName}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-80">{author.craft || 'Creator'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-5 border-b border-border/10 space-y-4 bg-background">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                    <Button variant="ghost" size="icon" onClick={handleLike} className="hover:scale-125 transition-transform hover:bg-transparent p-0 h-auto">
                                        <Heart className={`h-7 w-7 ${post.like_count > 0 ? 'fill-red-500 text-red-500' : ''}`} />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="hover:scale-125 transition-transform hover:bg-transparent p-0 h-auto">
                                        <MessageCircle className="h-7 w-7" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="hover:scale-125 transition-transform hover:bg-transparent p-0 h-auto">
                                        <Share2 className="h-7 w-7" />
                                    </Button>
                                </div>
                                <p className="font-black tracking-tight">{post.like_count || 0} Likes</p>
                            </div>
                        </div>

                        {/* Content & Comments */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-background">
                            <div className="flex gap-3.5 items-start">
                                <Avatar className="h-8 w-8 shrink-0">
                                    <AvatarImage src={author.avatar_url || undefined} />
                                    <AvatarFallback>{initials}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[14px] leading-relaxed">
                                        <span className="font-bold text-foreground mr-1.5 tracking-tight hover:underline cursor-pointer">
                                            {author?.username || authorName.toLowerCase().replace(/\s/g, '')}
                                        </span>
                                        {post.content.includes('JOB_SHARE::') ? (
                                            (() => {
                                                try {
                                                    const parts = post.content.split('JOB_SHARE::');
                                                    const caption = parts[0].trim();
                                                    const jsonStr = parts[parts.length - 1].trim();
                                                    const shareData = JSON.parse(jsonStr);
                                                    return (
                                                        <div className="inline space-y-3">
                                                            {caption && <FormattedText text={caption} className="inline text-foreground/90 leading-relaxed" />}
                                                            <div className="mt-3 block scale-90 origin-top-left">
                                                                <JobShareCard {...shareData} />
                                                            </div>
                                                        </div>
                                                    );
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
        </Dialog>
    );
};
