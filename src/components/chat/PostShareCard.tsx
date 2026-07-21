import { useState, useEffect } from 'react';
import { Film, Briefcase } from 'lucide-react';
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

    useEffect(() => {
        const fetchPostData = async () => {
            // Only fetch if we're missing critical data
            if (author?.full_name || author?.username) {
                if (preview && text) return;
            }

            try {
                const { data: postData } = await supabase
                    .from('posts')
                    .select('content, media_url, profiles(username, full_name, avatar_url, is_verified)')
                    .eq('id', postId)
                    .maybeSingle();

                if (postData) {
                    if (postData.profiles) {
                        const profile = Array.isArray(postData.profiles) ? postData.profiles[0] : postData.profiles;
                        setAuthor({
                            username: profile?.username || null,
                            full_name: profile?.full_name || null,
                            avatar_url: profile?.avatar_url || null,
                            is_verified: profile?.is_verified || false
                        });
                    }

                    if (!text) setText(postData.content);
                    if (!preview) {
                        setPreview(postData.media_url || undefined);
                    }
                }
            } catch (err) {
                console.error("Error fetching post data:", err);
            }
        };

        if (postId) {
            fetchPostData();
        }
    }, [postId, author, preview, text]);

    const isVideo = (url?: string) => {
        if (!url) return false;
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.quicktime'];
        return videoExtensions.some(ext => url.toLowerCase().includes(ext)) || url.includes('video');
    };

    // const displayName = author?.full_name || author?.username || 'User';

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
                <div className={`relative w-full ${!preview && text?.includes('JOB_SHARE::') ? 'py-6' : 'aspect-[4/5]'} bg-[#0a0a0a] flex items-center justify-center overflow-hidden`}>
                    {preview ? (
                        isVideo(preview) ? (
                            <video
                                src={preview}
                                className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
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
                                className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
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