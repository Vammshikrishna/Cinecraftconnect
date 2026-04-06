import { Link } from 'react-router-dom';
import { MarketplaceListing } from '@/types/marketplace';
import { MapPin, Star, User } from 'lucide-react';

interface ListingCardProps {
    listing: MarketplaceListing;
}

export const ListingCard = ({ listing }: ListingCardProps) => {
    const primaryImage = listing.images && listing.images.length > 0
        ? listing.images[0]
        : undefined;

    const averageRating = listing.average_rating || 0;
    const reviewCount = listing.review_count || 0;

    return (
        <Link to={`/marketplace/${listing.id}`} className="no-underline block group">
            <div className="relative h-full bg-zinc-50/80 dark:bg-card/60 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-[28px] overflow-hidden transition-all duration-500 hover:border-primary/50 hover:shadow-[0_20px_50px_-15px_rgba(var(--primary),0.15)] hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-br from-zinc-100/50 to-zinc-50/50 dark:from-card dark:to-muted/5 shadow-sm dark:shadow-none flex flex-col">
                {/* Image Section */}
                <div className="relative aspect-video overflow-hidden bg-muted flex-shrink-0">
                    {primaryImage ? (
                        <img
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
                    
                    {/* Category Badge overlaying image */}
                    <div className="absolute top-3 right-3 shadow-lg">
                        <div className="px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-md border border-white/20 text-[9px] font-black text-foreground uppercase tracking-[0.1em]">
                            {listing.category}
                        </div>
                    </div>
                </div>

                {/* Content Section */}
                <div className="p-5 md:p-6 flex flex-col flex-1 gap-4">
                    <div className="space-y-1">
                        <div className="flex items-start justify-between gap-3">
                            <h3 className="font-black text-lg md:text-xl tracking-tight text-foreground group-hover:text-primary transition-colors duration-300 line-clamp-2 leading-tight">
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
                            <div className="flex items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest gap-1.5 bg-black/5 dark:bg-white/5 py-1 px-2.5 rounded-lg border border-black/5 dark:border-white/5 max-w-full">
                                <MapPin size={10} className="text-primary/60 shrink-0" />
                                <span className="truncate">{listing.location}</span>
                            </div>
                            
                            {listing.profiles && (
                                <div className="flex items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest gap-1.5 bg-black/5 dark:bg-white/5 py-1 px-2.5 rounded-lg border border-black/5 dark:border-white/5 max-w-full">
                                    <User size={10} className="text-primary/60 shrink-0" />
                                    <span className="truncate">{listing.profiles.username || listing.profiles.full_name || 'Anonymous'}</span>
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

                {/* Subtle outer glow border */}
                <div className="absolute inset-0 border border-black/5 dark:border-white/5 rounded-[28px] pointer-events-none group-hover:border-primary/20 transition-colors" />
            </div>
        </Link>
    );
};
