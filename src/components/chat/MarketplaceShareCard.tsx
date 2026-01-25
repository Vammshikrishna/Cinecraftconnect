import { Link } from 'react-router-dom';
import { Camera } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface MarketplaceShareCardProps {
    listingId: string;
    title: string;
    previewUrl?: string;
    price: number;
    author?: {
        username: string | null;
        avatar_url: string | null;
    };
}

export const MarketplaceShareCard = ({ listingId, title, previewUrl, price, author }: MarketplaceShareCardProps) => {
    return (
        <Link to={`/marketplace/${listingId}`} className="block w-full max-w-[280px] bg-[#262626] rounded-[22px] overflow-hidden transition-opacity hover:opacity-95 no-underline">
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
                        {author?.username || 'Seller'}
                    </span>
                    <span className="text-[10px] text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded-full ml-1">
                        Seller
                    </span>
                </div>
            </div>

            {/* Media */}
            <div className="relative w-full aspect-video bg-zinc-800 flex items-center justify-center overflow-hidden">
                {previewUrl ? (
                    <img
                        src={previewUrl}
                        alt="Listing preview"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="flex flex-col items-center gap-2 text-zinc-500">
                        <Camera className="h-8 w-8" />
                        <span className="text-xs">No Preview</span>
                    </div>
                )}
                {/* Price Tag Overlay */}
                <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white text-xs font-bold px-2 py-1 rounded-md">
                    ₹{price}/day
                </div>
            </div>

            {/* Footer */}
            <div className="p-3">
                <h4 className="text-sm font-bold text-white leading-tight mb-1 line-clamp-1">{title}</h4>
                <div className="flex items-center text-xs text-zinc-400">
                    <span className="text-primary font-medium">View Listing</span>
                </div>
            </div>
        </Link>
    );
};
