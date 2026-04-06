import { useState } from 'react';
import { Film, BadgeCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PostDialog } from './PostDialog';
import { JobShareCard } from './JobShareCard';
import { Briefcase } from 'lucide-react';

interface PostShareCardProps {
    postId: string;
    previewUrl?: string;
    caption?: string;
    author?: {
        username: string | null;
        avatar_url: string | null;
        is_verified?: boolean;
    };
}

export const PostShareCard = ({ postId, previewUrl, caption, author }: PostShareCardProps) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <div 
                onClick={() => setIsOpen(true)} 
                className="block w-full max-w-[280px] bg-[#262626] rounded-[22px] overflow-hidden transition-all hover:opacity-95 cursor-pointer border border-white/5 active:scale-[0.98]"
            >
                {/* Header */}
                <div className="flex items-center gap-2 p-3">
                    <Avatar className="h-6 w-6">
                        <AvatarImage src={author?.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px] bg-zinc-700 text-zinc-300">
                            {author?.username?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-1 min-w-0">
                        <span className="text-sm font-semibold text-white truncate">
                            {author?.username || 'ReelSphere User'}
                        </span>
                        {author?.is_verified && (
                            <BadgeCheck className="h-3.5 w-3.5 text-[#0095F6] flex-shrink-0" fill="#0095F6" color="white" />
                        )}
                    </div>
                </div>

                <div className="relative w-full aspect-[4/5] bg-[#1a1a1a] flex items-center justify-center overflow-hidden">
                    {previewUrl ? (
                        <img
                            src={previewUrl}
                            alt="Post preview"
                            className="w-full h-full object-cover"
                        />
                    ) : caption?.includes('JOB_SHARE::') ? (
                        <div className="w-full h-full bg-[#0a0a0a] flex flex-col items-center justify-center p-3 relative overflow-hidden group/hero">
                            {(() => {
                                try {
                                    const parts = caption.split('JOB_SHARE::');
                                    const jsonStr = parts[parts.length - 1].trim();
                                    const shareData = JSON.parse(jsonStr);

                                    return (
                                        <>
                                            {/* Rich Atmospheric Branding */}
                                            <div className="absolute inset-0 z-0">
                                                <img
                                                    src={shareData.logoUrl || undefined}
                                                    alt=""
                                                    className="w-full h-full object-cover blur-2xl opacity-20 scale-150"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60" />
                                            </div>

                                            <div className="relative z-10 w-full flex flex-col items-center gap-3">
                                                {/* Career Label */}
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-md scale-90">
                                                    <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                                                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-primary">Official Opportunity</span>
                                                </div>

                                                <div className="w-full scale-[0.85] origin-center transition-transform duration-500 group-hover/hero:scale-[0.88]">
                                                    <JobShareCard {...shareData} />
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
                        <div className="flex flex-col items-center gap-2 text-zinc-500">
                            <Film className="h-8 w-8" />
                            <span className="text-xs tracking-widest font-bold uppercase opacity-60">No Preview</span>
                        </div>
                    )}
                </div>

                {/* Footer / Caption */}
                {caption && (
                    <div className="p-3 pt-2">
                        {caption.includes('JOB_SHARE::') ? (
                            (() => {
                                try {
                                    const parts = caption.split('JOB_SHARE::');
                                    const text = parts[0].trim();
                                    return text ? <p className="text-[13px] leading-snug text-white line-clamp-2">{text}</p> : null;
                                } catch (e) {
                                    return <p className="text-[13px] leading-snug text-white line-clamp-2">{caption}</p>;
                                }
                            })()
                        ) : (
                            <p className="text-[13px] leading-snug text-white line-clamp-2">
                                {caption}
                            </p>
                        )}
                    </div>
                )}
            </div>

            <PostDialog 
                postId={postId} 
                isOpen={isOpen} 
                onOpenChange={setIsOpen} 
            />
        </>
    );
};
