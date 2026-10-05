import { useAppNavigation } from '@/contexts/NavigationContext';
import { LazyImage } from '@/components/performance/LazyImage';
import { MarketplaceListing } from '@/types/marketplace';
import { MapPin, Star, User, MoreVertical, Trash2, X, Heart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppRole } from '@/hooks/useAppRole';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface ListingCardProps {
    listing: MarketplaceListing;
    onDismiss?: (id: string) => void;
}

export const ListingCard = ({ listing, onDismiss }: ListingCardProps) => {
    const { user } = useAuth();
    const { isInternal } = useAppRole();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { push } = useAppNavigation();
    
    const isOwner = user?.id === listing.user_id;
    const canManage = isOwner || isInternal;

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!confirm('Are you sure you want to delete this listing?')) return;
        
        const { error } = await supabase
            .from('marketplace_listings')
            .delete()
            .eq('id', listing.id);
            
        if (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: 'Listing deleted successfully' });
            queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
        }
    };

    const { data: isWishlisted, isLoading: isWishlistLoading } = useQuery({
        queryKey: ['wishlist', listing.id, user?.id],
        queryFn: async () => {
            if (!user) return false;
            const { data } = await supabase
                .from('marketplace_wishlists' as any)
                .select('id')
                .eq('listing_id', listing.id)
                .eq('user_id', user.id)
                .maybeSingle();
            return !!data;
        },
        enabled: !!user
    });

    const toggleWishlist = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!user) {
            toast({ title: 'Sign in required', description: 'Please sign in to save items to your wishlist.', variant: 'destructive' });
            return;
        }

        if (isWishlisted) {
            await supabase
                .from('marketplace_wishlists' as any)
                .delete()
                .eq('listing_id', listing.id)
                .eq('user_id', user.id);
            toast({ title: 'Removed', description: 'Removed from wishlist' });
        } else {
            await supabase
                .from('marketplace_wishlists' as any)
                .insert({ listing_id: listing.id, user_id: user.id });
            toast({ title: 'Saved', description: 'Added to wishlist' });
        }
        queryClient.invalidateQueries({ queryKey: ['wishlist', listing.id, user?.id] });
    };

    const primaryImage = listing.images && listing.images.length > 0
        ? listing.images[0]
        : undefined;

    const averageRating = listing.average_rating || 0;
    const reviewCount = listing.review_count || 0;

    const getConditionColor = (grade: string) => {
        switch(grade) {
            case 'Mint': return 'bg-emerald-500/90 text-white shadow-emerald-900/20';
            case 'Excellent': return 'bg-blue-500/90 text-white shadow-blue-900/20';
            case 'Good': return 'bg-yellow-500/90 text-yellow-950 shadow-yellow-900/20';
            case 'Fair': return 'bg-orange-500/90 text-white shadow-orange-900/20';
            default: return 'bg-gray-500/90 text-white shadow-gray-900/20';
        }
    };

    return (
        <div onClick={() => push(`/marketplace/${listing.id}`)} className="no-underline block group h-full cursor-pointer">
            <div className="glass-card-premium h-full flex flex-col transition-transform duration-500 hover:-translate-y-2">
                {/* Image Section */}
                <div className="relative aspect-video overflow-hidden bg-muted flex-shrink-0">
                    {primaryImage ? (
                        <LazyImage
                            src={primaryImage}
                            alt={listing.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                            }}
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center">
                            <div className="text-muted-foreground/30 font-black uppercase tracking-widest text-[10px]">No Image</div>
                        </div>
                    )}

                    {onDismiss && (
                        <button 
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onDismiss(listing.id);
                            }}
                            className="absolute top-3 left-3 z-30 h-7 w-7 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white/60 hover:text-white transition-all opacity-0 group-hover:opacity-100 backdrop-blur-md border border-white/10 hover:border-white/20"
                            title="Dismiss suggestion"
                        >
                            <X size={14} strokeWidth={3} />
                        </button>
                    )}
                    
                    {/* Category Badge overlaying image */}
                    <div className="absolute top-3 right-3 flex items-center gap-2 shadow-lg">
                        {listing.is_bundle && (
                            <div className="px-2.5 py-1 rounded-full bg-purple-600/90 backdrop-blur-md border border-white/20 text-[9px] font-black text-white uppercase tracking-[0.1em] flex items-center gap-1 shadow-lg shadow-purple-900/20">
                                <span>📦</span> BUNDLE
                            </div>
                        )}
                        {listing.condition_grade && (
                            <div className={`px-2.5 py-1 rounded-full backdrop-blur-md border border-white/20 text-[9px] font-black uppercase tracking-[0.1em] shadow-lg ${getConditionColor(listing.condition_grade)}`}>
                                {listing.condition_grade}
                            </div>
                        )}
                        <div className="px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-md border border-white/20 text-[9px] font-black text-foreground uppercase tracking-[0.1em]">
                            {listing.category}
                        </div>
                        
                        {user && !isOwner && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={toggleWishlist}
                                disabled={isWishlistLoading}
                                className={cn(
                                    "h-6 w-6 rounded-full backdrop-blur-md border border-white/20 hover:scale-110 transition-transform",
                                    isWishlisted ? "bg-red-500/20 hover:bg-red-500/30" : "bg-background/80 hover:bg-background"
                                )}
                            >
                                <Heart 
                                    size={12} 
                                    className={cn(isWishlisted ? "fill-red-500 text-red-500" : "text-foreground")} 
                                />
                            </Button>
                        )}
                        
                        {canManage && (
                            <div className="relative z-30" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full bg-background/80 backdrop-blur-md hover:bg-background border border-white/20">
                                            <MoreVertical size={12} className="text-foreground" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-background border-border">
                                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleDelete}>
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}
                    </div>
                </div>

                {/* Content Section */}
                <div className="p-5 md:p-6 flex flex-col flex-1 gap-4">
                    <div className="space-y-1">
                        <div className="flex items-start justify-between gap-3">
                            <h3 className="font-serif text-xl md:text-2xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors duration-300 line-clamp-2 leading-tight">
                                {listing.title}
                            </h3>
                            {reviewCount > 0 && (
                                <div className="px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex flex-col items-center justify-center shrink-0 mt-0.5">
                                    <div className="flex items-center gap-0.5">
                                        <Star size={10} className="text-yellow-500 fill-yellow-500" />
                                        <span className="text-[10px] font-black text-yellow-600 dark:text-yellow-400">{averageRating.toFixed(1)}</span>
                                    </div>
                                    <span className="text-[7px] font-bold text-yellow-600/60 dark:text-yellow-400/60 uppercase tracking-widest">{reviewCount}</span>
                                </div>
                            )}
                        </div>

                        <p className="text-[11px] md:text-xs text-muted-foreground/80 leading-relaxed line-clamp-2 font-medium">
                            {listing.description}
                        </p>
                    </div>

                    <div className="space-y-2.5 mt-auto pt-2">
                        {/* Meta Rows */}
                        <div className="flex flex-wrap items-center gap-2 mt-auto">
                            <div className="font-mono flex items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest gap-1.5 bg-muted/10 py-1 px-2.5 rounded border border-border/40 max-w-full">
                                <span className="truncate">LOC // {listing.location}</span>
                            </div>
                            
                            {listing.profiles && (
                                <div className="font-mono flex items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest gap-1.5 bg-muted/10 py-1 px-2.5 rounded border border-border/40 max-w-full">
                                    <span className="truncate">USER // {listing.profiles.username || listing.profiles.full_name || 'Anonymous'}</span>
                                </div>
                            )}
                        </div>

                        {/* Price footer */}
                        <div className="flex items-end justify-between pt-3 border-t border-black/5 dark:border-white/5 mt-2">
                            <div className="flex items-baseline text-primary font-black">
                                <span className="text-sm mr-0.5 opacity-60">₹</span>
                                <span className="text-2xl tracking-tighter">{listing.price_per_day}</span>
                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1.5 opacity-60">/ Day</span>
                            </div>
                            {listing.price_per_week && (
                                <div className="text-[10px] font-bold text-muted-foreground uppercase bg-primary/5 px-2 py-1 rounded-md border border-primary/10">
                                    ₹{listing.price_per_week} / Wk
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
