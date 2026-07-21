import { CornerBrackets } from '@/components/ui/CornerBrackets';
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
                    .maybeSingle();

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
            className="block w-[220px] shrink-0 glass-card-premium rounded-2xl overflow-hidden transition-all duration-500 hover:-translate-y-2 active:scale-[0.98] no-underline group shadow-2xl border border-black/10 dark:border-white/10"
        >
            <CornerBrackets />
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

                {/* Category Badge - bottom-left of image */}
                {category && (
                    <div className="font-mono absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/60 border border-white/20 text-white text-[7px] font-bold uppercase tracking-widest rounded backdrop-blur-md">
                        CAT // {category}
                    </div>
                )}


            </div>

            {/* Premium Content Footer */}
            <div className="p-5 space-y-5 bg-white dark:bg-black/60 backdrop-blur-md">
                <div className="space-y-2">
                    <h3 className="font-serif text-[13px] font-bold text-foreground leading-tight tracking-tight group-hover:text-primary transition-colors uppercase">
                        {title || 'Equipment Listing'}
                    </h3>
                </div>

                {description && (
                    <p className="text-[11px] text-foreground/70 font-medium leading-relaxed line-clamp-2 italic opacity-80 border-l-2 border-primary/30 pl-3">
                        {description}
                    </p>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                    {location && (
                        <div className="font-mono flex items-center text-[7.5px] text-muted-foreground font-bold uppercase tracking-widest bg-muted/10 border border-border/40 px-2 py-0.5 rounded w-max">
                            <span className="truncate">LOC // {location}</span>
                        </div>
                    )}
                    {price !== undefined && (
                        <div className="font-mono flex items-center gap-0.5 px-2 py-0.5 bg-green-500/5 border border-green-500/20 rounded text-[7.5px] font-bold text-green-600 dark:text-green-400 uppercase tracking-widest">
                            ₹{price.toLocaleString()} <span className="text-[6.5px] text-muted-foreground">/ Day</span>
                        </div>
                    )}
                </div>

                {/* Who posted - above CTA */}
                {author && (
                    <div className="flex items-center gap-2.5 pt-2 border-t border-border/10">
                        <Avatar className="h-7 w-7 rounded-lg border border-border/40 shadow-sm shrink-0">
                            <AvatarImage src={author?.avatar_url || undefined} />
                            <AvatarFallback className="text-[9px] bg-primary text-black font-black">
                                {author?.username?.[0]?.toUpperCase() || 'S'}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-black text-foreground uppercase tracking-wider truncate leading-tight">{author?.username || 'Verified Seller'}</span>
                            <span className="text-[7.5px] text-primary font-black uppercase tracking-widest leading-tight">Verified Listing</span>
                        </div>
                    </div>
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

