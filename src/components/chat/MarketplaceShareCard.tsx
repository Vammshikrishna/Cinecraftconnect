import { Link } from 'react-router-dom';
import { ShoppingBag, MapPin } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getOptimizedImage } from '@/utils/image-optimization';

interface MarketplaceShareCardProps {
    listingId: string;
    title?: string;
    previewUrl?: string;
    price?: number;
    description?: string;
    category?: string;
    location?: string;
    author?: {
        username: string | null;
        avatar_url: string | null;
    };
}

export const MarketplaceShareCard = ({
    listingId,
    title: initialTitle,
    previewUrl: initialPreview,
    price: initialPrice,
    description: initialDesc,
    category: initialCat,
    location: initialLoc,
    author: initialAuthor
}: MarketplaceShareCardProps) => {
    const [title, setTitle] = useState(initialTitle);
    const [previewUrl, setPreviewUrl] = useState(initialPreview);
    const [price, setPrice] = useState(initialPrice);
    const [description, setDescription] = useState(initialDesc);
    const [category, setCategory] = useState(initialCat);
    const [location, setLocation] = useState(initialLoc);
    const [author, setAuthor] = useState(initialAuthor);

    useEffect(() => {
        const fetchListingDetails = async () => {
            if (!listingId || listingId === 'undefined') return;
            if (initialPrice !== undefined && initialDesc) return;

            try {
                const { data, error } = await supabase
                    .from('marketplace_listings')
                    .select('*, profiles(username, avatar_url, full_name)')
                    .eq('id', listingId)
                    .single();

                if (data && !error) {
                    setTitle(data.title);
                    setPrice(data.price_per_day);
                    setPreviewUrl(data.images?.[0] || undefined);
                    setDescription(data.description || undefined);
                    setCategory(data.category || undefined);
                    setLocation(data.location || undefined);
                    setAuthor({
                        username: data.profiles?.username || data.profiles?.full_name || 'Seller',
                        avatar_url: data.profiles?.avatar_url || null
                    });
                }
            } catch (err) {
                console.error('Error self-healing marketplace card:', err);
            }
        };

        fetchListingDetails();
    }, [listingId, initialPrice, initialDesc]);

    return (
        <Link
            to={`/marketplace/${listingId}`}
            className="block w-full max-w-[240px] min-w-[200px] glass-card-premium rounded-2xl overflow-hidden transition-all duration-500 hover:-translate-y-2 active:scale-[0.98] no-underline group shadow-2xl border border-white/10"
        >
            {/* Visual Header - High Impact Media */}
            <div className="relative aspect-video w-full overflow-hidden bg-muted">
                {previewUrl ? (
                    <img
                        src={getOptimizedImage(previewUrl, { width: 500, quality: 90 })}
                        alt={title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 brightness-95"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/5 flex items-center justify-center">
                        <ShoppingBag className="h-16 w-16 text-primary/30 group-hover:scale-110 transition-transform duration-500" />
                    </div>
                )}

                {/* Glassmorphic Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                {/* Category Badge - Top Left */}
                {category && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-primary text-black text-[8px] font-black uppercase tracking-[0.2em] rounded-md shadow-2xl animate-in fade-in slide-in-from-left-2 duration-700">
                        {category}
                    </div>
                )}

                {/* Premium Price Tag - Top Right */}
                {price !== undefined && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-black/60 backdrop-blur-xl rounded-xl border border-white/20 shadow-2xl animate-in fade-in zoom-in duration-700">
                        <span className="text-[10px] font-black text-white tracking-tight">₹{price.toLocaleString()}</span>
                        <span className="text-[7px] font-bold text-white/50 uppercase tracking-widest">/ Day</span>
                    </div>
                )}

                {/* Identity Overlay - Bottom Center-ish */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[90%] flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-2xl rounded-xl border border-white/20 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-700">
                    <Avatar className="h-8 w-8 rounded-xl border border-white/20 shadow-sm">
                        <AvatarImage src={author?.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px] bg-primary text-black font-black">
                            {author?.username?.[0]?.toUpperCase() || 'S'}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-black text-white uppercase tracking-widest truncate">
                            {author?.username || 'Verified Seller'}
                        </span>
                        <span className="text-[7px] text-primary font-bold uppercase tracking-[0.2em]">Verified Listing</span>
                    </div>
                </div>
            </div>

            {/* Premium Content Footer */}
            <div className="p-5 space-y-5 bg-background/80 backdrop-blur-md">
                <div className="space-y-2">
                    <h3 className="text-[18px] font-black text-foreground leading-tight tracking-tighter group-hover:text-primary transition-colors uppercase">
                        {title || 'Equipment Listing'}
                    </h3>
                    {location && (
                        <div className="flex items-center gap-2 text-[9px] text-muted-foreground font-black uppercase tracking-[0.15em]">
                            <MapPin size={10} className="text-primary/80" />
                            <span className="truncate">{location}</span>
                        </div>
                    )}
                </div>

                {description && (
                    <p className="text-[11px] text-foreground/70 font-medium leading-relaxed line-clamp-2 italic opacity-80 border-l-2 border-primary/30 pl-3">
                        {description}
                    </p>
                )}

                <div className="pt-2">
                    <div className="w-full py-3 bg-primary text-black text-center rounded-2xl hover:bg-primary/90 transition-all text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 flex items-center justify-center gap-3">
                        <ShoppingBag size={14} className="fill-black" />
                        Book Equipment
                    </div>
                </div>
            </div>
        </Link>

    );
};

