import { Link } from 'react-router-dom';
import { Film, BadgeCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
    return (
        <Link to={`/feed?post=${postId}`} className="block w-full max-w-[280px] bg-[#262626] rounded-[22px] overflow-hidden transition-opacity hover:opacity-95 no-underline">
            {/* Header */}
            <div className="flex items-center gap-2 p-3">
                <Avatar className="h-6 w-6">
                    <AvatarImage src={author?.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px] bg-zinc-700 text-zinc-300">
                        {author?.username?.[0]?.toUpperCase()}
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

            {/* Media */}
            <div className="relative w-full aspect-[4/5] bg-zinc-800 flex items-center justify-center overflow-hidden">
                {previewUrl ? (
                    <img
                        src={previewUrl}
                        alt="Post preview"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="flex flex-col items-center gap-2 text-zinc-500">
                        <Film className="h-8 w-8" />
                        <span className="text-xs">No Preview</span>
                    </div>
                )}
            </div>

            {/* Footer / Caption */}
            {caption && (
                <div className="p-3 pt-2">
                    <p className="text-[13px] leading-snug text-white line-clamp-2">
                        {caption}
                    </p>
                </div>
            )}
        </Link>
    );
};
