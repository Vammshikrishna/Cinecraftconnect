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
                        <div className="w-full h-full bg-gradient-to-br from-emerald-500/20 via-primary/10 to-blue-600/5 flex items-center justify-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-50" />
                            <Briefcase className="w-12 h-12 text-primary/40 animate-pulse" />
                            <span className="absolute bottom-4 text-[10px] font-black uppercase tracking-[0.3em] text-primary/60">Professional Opportunity</span>
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
                                    const jsonStr = parts[parts.length - 1].trim();
                                    const shareData = JSON.parse(jsonStr);
                                    return (
                                        <div className="space-y-3">
                                            {text && <p className="text-[13px] leading-snug text-white line-clamp-1">{text}</p>}
                                            <div className="scale-75 origin-top-left -mb-10">
                                                <JobShareCard {...shareData} />
                                            </div>
                                        </div>
                                    );
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
