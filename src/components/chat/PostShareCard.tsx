import { useState, useEffect } from 'react';
import { Film, Briefcase, AlertCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PostDialog } from './PostDialog';
import { JobShareCard } from './JobShareCard';
import { getOptimizedImage } from '@/utils/image-optimization';
import { supabase } from '@/integrations/supabase/client';
import VerificationBadge from '../common/VerificationBadge';
import { CornerBrackets } from '@/components/ui/CornerBrackets';

interface PostShareCardProps {
    postId: string;
    previewUrl?: string;
    caption?: string;
    author?: {
        username: string | null;
        full_name?: string | null;
        avatar_url: string | null;
        is_verified?: boolean;
    };
}

export const PostShareCard = ({ postId, previewUrl, caption, author: initialAuthor }: PostShareCardProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [author, setAuthor] = useState(initialAuthor);
    const [preview, setPreview] = useState(previewUrl);
    const [text, setText] = useState(caption);
    const [mediaItem, setMediaItem] = useState<any>(null);
    const [isDeleted, setIsDeleted] = useState(false);

    useEffect(() => {
        const fetchPostData = async () => {
            try {
                const { data: postData, error } = await supabase
                    .from('posts')
                    .select('id, content, media_url, media_items, profiles(username, full_name, avatar_url, is_verified)')
                    .eq('id', postId)
                    .maybeSingle();

                if (!postData || error) {
                    setIsDeleted(true);
                } else {
                    setIsDeleted(false);
                    if (postData.profiles) {
                        const profile = Array.isArray(postData.profiles) ? postData.profiles[0] : postData.profiles;
                        setAuthor({
                            username: profile?.username || null,
                            full_name: profile?.full_name || null,
                            avatar_url: profile?.avatar_url || null,
                            is_verified: profile?.is_verified || false
                        });
                    }

                    setText(postData.content || "");
                    setPreview(postData.media_url || undefined);
                    if (postData.media_items && Array.isArray(postData.media_items) && postData.media_items.length > 0) {
                        setMediaItem(postData.media_items[0]);
                    } else {
                        setMediaItem(null);
                    }
                }
            } catch (err) {
                console.error("Error fetching post data:", err);
                setIsDeleted(true);
            }
        };

        if (postId) {
            fetchPostData();
        }
    }, [postId]);

    const isVideo = (url?: string) => {
        if (!url) return false;
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.quicktime'];
        return videoExtensions.some(ext => url.toLowerCase().includes(ext)) || url.includes('video');
    };

    const isFilterEdited = (filter?: string) => {
        if (!filter || filter === 'none') return false;
        const normalized = filter.trim();
        if (normalized === 'brightness(100%) contrast(100%) saturate(100%) sepia(0%)') return false;
        return true;
    };

    const getMediaStyles = (item: any) => {
        if (!item) return { imageStyles: {}, wrapperStyles: {}, hasAspectRatio: false };

        const styles: React.CSSProperties = {};
        const wrapperStyles: React.CSSProperties = {};

        if (isFilterEdited(item.filter)) {
            styles.filter = item.filter;
        }

        const hasZoom = item.zoom !== undefined && item.zoom !== null && item.zoom !== 100;
        const panX = item.pan?.x || 0;
        const panY = item.pan?.y || 0;
        const hasPan = panX !== 0 || panY !== 0;
        if (hasZoom || hasPan) {
            const scaleVal = hasZoom ? (item.zoom! / 100) : 1;
            styles.transform = `translate(${panX}px, ${panY}px) scale(${scaleVal})`;
        }

        const hasCrop = item.crop && (item.crop.top > 0 || item.crop.right > 0 || item.crop.bottom > 0 || item.crop.left > 0);
        if (hasCrop) {
            styles.clipPath = `inset(${item.crop.top || 0}% ${item.crop.right || 0}% ${item.crop.bottom || 0}% ${item.crop.left || 0}%)`;
        }

        const hasAspectRatio = item.aspectRatio && item.aspectRatio !== 'original' && item.aspectRatio !== 'free';
        if (hasAspectRatio) {
            const ratioMap: Record<string, string> = {
                '1:1': '1/1',
                '4:5': '4/5',
                '16:9': '16/9',
            };
            if (ratioMap[item.aspectRatio!]) {
                wrapperStyles.aspectRatio = ratioMap[item.aspectRatio!];
            }
        }

        return { imageStyles: styles, wrapperStyles, hasAspectRatio: !!hasAspectRatio };
    };

    const activeItem = mediaItem || (preview ? { url: preview, type: isVideo(preview) ? 'video' : 'image' } : null);
    const { imageStyles, wrapperStyles, hasAspectRatio } = getMediaStyles(activeItem);

    if (isDeleted) {
        return (
            <div className="w-[220px] sm:w-[240px] p-4 rounded-2xl bg-muted/30 border border-border/40 text-center flex flex-col items-center justify-center gap-2 my-1 shadow-sm">
                <div className="p-2.5 rounded-full bg-muted/60 text-muted-foreground">
                    <AlertCircle className="h-5 w-5" />
                </div>
                <div className="space-y-0.5">
                    <p className="text-xs font-bold text-foreground">Post unavailable</p>
                    <p className="text-[11px] text-muted-foreground leading-snug">This post was deleted by the owner.</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div
                onClick={() => setIsOpen(true)}
                className="relative block w-[220px] shrink-0 glass-card-premium rounded-xl overflow-hidden transition-all duration-500 hover:-translate-y-2 active:scale-[0.98] cursor-pointer group shadow-lg"
            >
                <CornerBrackets />
                {/* Header Section */}
                <div className="p-3 flex items-center gap-2.5 bg-white dark:bg-black/60 backdrop-blur-md border-b border-black/10 dark:border-white/10">
                    <div className="relative shrink-0">
                        <Avatar className="h-7 w-7 border border-black/20 dark:border-white/20">
                            <AvatarImage src={getOptimizedImage(author?.avatar_url || '', { width: 64, height: 64 }) || undefined} />
                            <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-bold">
                                {(author?.full_name || author?.username || '?').charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                        <span className="font-serif text-base font-bold text-foreground truncate tracking-tight">
                            {author?.full_name || author?.username || 'User'}
                        </span>
                        {(author?.is_verified || (author?.full_name?.toLowerCase().includes('vamshi'))) && (
                            <VerificationBadge size="xs" />
                        )}
                    </div>
                </div>

                {/* Media Section */}
                <div
                    className={`relative w-full ${!preview && text?.includes('JOB_SHARE::') ? 'py-6' : 'aspect-[4/5]'} bg-[#0a0a0a] flex items-center justify-center overflow-hidden`}
                    style={hasAspectRatio ? wrapperStyles : undefined}
                >
                    {preview ? (
                        isVideo(preview) ? (
                            <video
                                src={preview}
                                className={`w-full h-full ${hasAspectRatio ? 'object-cover' : 'object-contain'} transition-transform duration-700 group-hover:scale-105`}
                                style={imageStyles}
                                muted
                                loop
                                playsInline
                                onMouseOver={e => e.currentTarget.play()}
                                onMouseOut={e => e.currentTarget.pause()}
                            />
                        ) : (
                            <img
                                src={getOptimizedImage(preview, { width: 400 })}
                                alt="Post Preview"
                                className={`w-full h-full ${hasAspectRatio ? 'object-cover' : 'object-contain'} transition-transform duration-700 group-hover:scale-105`}
                                style={imageStyles}
                            />
                        )
                    ) : text?.includes('JOB_SHARE::') ? (
                        <div className="w-full h-full bg-[#050505] flex flex-col items-center justify-center p-3 relative overflow-hidden group/hero">
                            {(() => {
                                try {
                                    const parts = text.split('JOB_SHARE::');
                                    const jsonStr = parts[parts.length - 1].trim();
                                    const shareData = JSON.parse(jsonStr);

                                    return (
                                        <>
                                            <div className="absolute inset-0 z-0">
                                                <img
                                                    src={getOptimizedImage(shareData.logoUrl || '', { width: 100 }) || undefined}
                                                    alt=""
                                                    className="w-full h-full object-cover blur-2xl opacity-20 scale-150"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60" />
                                            </div>

                                            <div className="relative z-10 w-full flex flex-col items-center gap-3">
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-md scale-90">
                                                    <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                                                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-primary">Official Opportunity</span>
                                                </div>

                                                <div className="w-full px-1">
                                                    <JobShareCard {...shareData} compact={true} className="w-full" />
                                                </div>
                                            </div>
                                        </>
                                    );
                                } catch (e) {
                                    return <Briefcase className="w-10 h-10 text-primary/40" />;
                                }
                            })()}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 text-zinc-700">
                            <Film className="h-8 w-8" />
                            <span className="text-[9px] tracking-[0.2em] font-black uppercase opacity-40">No Preview</span>
                        </div>
                    )}
                </div>

                {/* Footer / Caption Section */}
                {text && (
                    <div className="p-3 bg-white dark:bg-black/60 backdrop-blur-md border-t border-black/10 dark:border-white/10">
                        {text.includes('JOB_SHARE::') ? (
                            (() => {
                                try {
                                    const parts = text.split('JOB_SHARE::');
                                    const actualCaption = parts[0].trim();
                                    const jsonStr = parts[parts.length - 1].trim();
                                    const shareData = JSON.parse(jsonStr);
                                    return (
                                        <div className="space-y-2">
                                            {actualCaption && (
                                                <p className="text-[13px] leading-snug text-foreground/90 line-clamp-2">
                                                    {actualCaption}
                                                </p>
                                            )}
                                            {preview && (
                                                <div className="scale-[0.85] origin-top-left -mb-4">
                                                    <JobShareCard {...shareData} />
                                                </div>
                                            )}
                                        </div>
                                    );
                                } catch (e) {
                                    return (
                                        <p className="text-[13px] leading-snug text-foreground/90 line-clamp-2">
                                            {text}
                                        </p>
                                    );
                                }
                            })()
                        ) : (
                            <p className="text-[13px] leading-snug text-foreground/90 line-clamp-2">
                                {text}
                            </p>
                        )}
                    </div>
                )}
            </div>

            <PostDialog
                postId={postId}
                isOpen={isOpen}
                onOpenChange={setIsOpen}
                initialData={{
                    id: postId,
                    content: text,
                    media_url: preview,
                    media_type: isVideo(preview) ? 'video' : 'image',
                    media_items: mediaItem ? [mediaItem] : undefined,
                    profiles: {
                        full_name: author?.full_name,
                        username: author?.username,
                        avatar_url: author?.avatar_url,
                        is_verified: author?.is_verified
                    }
                }}
            />
        </>
    );
};