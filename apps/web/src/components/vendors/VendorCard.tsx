import { useAppNavigation } from '@/contexts/NavigationContext';
import { LazyImage } from '@/components/performance/LazyImage';
import { Vendor } from '@/types/marketplace';
import { Star, CheckCircle2, MoreVertical, Trash2, X } from 'lucide-react';
import { useAppRole } from '@/hooks/useAppRole';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useVendorMutation } from '@/hooks/mutations/useVendorMutation';

interface VendorCardProps {
    vendor: Vendor;
    onDismiss?: (id: string) => void;
}

/** Same shape and size as the gear / location listing card, so mixed lists line up. */
export const VendorCard = ({ vendor, onDismiss }: VendorCardProps) => {
    const { push } = useAppNavigation();
    const logoUrl = vendor.logo_url || undefined;
    const cover = vendor.images?.[0];
    const categories = vendor.category || [];
    const { isAdmin } = useAppRole();
    const { toast } = useToast();
    const averageRating = vendor.average_rating || 0;
    const reviewCount = vendor.review_count || 0;

    const { deleteVendor } = useVendorMutation();

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!confirm('Are you sure you want to delete this vendor?')) return;

        try {
            await deleteVendor(vendor.id);
            toast({ title: "Success", description: "Vendor deleted successfully" });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    return (
        <div onClick={() => push(`/vendors/${vendor.id}`)} className="no-underline block group h-full relative cursor-pointer">
            <div className="glass-card-premium h-full flex flex-col transition-transform duration-500 hover:-translate-y-2">
                {/* Cover */}
                <div className="relative aspect-video overflow-hidden bg-muted flex-shrink-0">
                    {cover ? (
                        <LazyImage
                            src={cover}
                            alt={vendor.business_name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center">
                            <div className="w-20 h-20 rounded-2xl border-4 border-background shadow-xl ring-1 ring-black/5 dark:ring-white/10 bg-background overflow-hidden transform group-hover:scale-105 transition-transform duration-500">
                                {logoUrl ? (
                                    <LazyImage src={logoUrl} alt={vendor.business_name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="h-full w-full bg-primary/10 text-primary flex items-center justify-center text-3xl font-black uppercase">
                                        {vendor.business_name?.[0]}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {onDismiss && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onDismiss(vendor.id);
                            }}
                            className="absolute top-3 left-3 z-30 h-7 w-7 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white/60 hover:text-white transition-all opacity-0 group-hover:opacity-100 backdrop-blur-md border border-white/10 hover:border-white/20"
                            title="Dismiss suggestion"
                        >
                            <X size={14} strokeWidth={3} />
                        </button>
                    )}

                    <div className="absolute top-3 right-3 flex items-center gap-2 shadow-lg">
                        {vendor.is_verified && (
                            <div className="px-2.5 py-1 rounded-full bg-primary/90 backdrop-blur-md border border-white/20 text-[9px] font-black text-primary-foreground uppercase tracking-[0.1em] flex items-center gap-1 shadow-lg">
                                <CheckCircle2 size={10} /> VERIFIED
                            </div>
                        )}
                        <div className="px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-md border border-white/20 text-[9px] font-black text-foreground uppercase tracking-[0.1em]">
                            {categories[0] || 'Vendor'}
                        </div>
                        {isAdmin && (
                            <div className="relative z-30" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full bg-background/80 backdrop-blur-md hover:bg-background border border-white/20">
                                            <MoreVertical size={12} className="text-foreground" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-600">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete Vendor
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 md:p-6 flex flex-col flex-1 gap-4">
                    <div className="space-y-1">
                        <div className="flex items-start justify-between gap-3">
                            <h3 className="font-serif text-xl md:text-2xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors duration-300 line-clamp-2 leading-tight">
                                {vendor.business_name}
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
                            {vendor.description}
                        </p>
                    </div>

                    <div className="space-y-2.5 mt-auto pt-2">
                        <div className="flex flex-wrap items-center gap-2 mt-auto">
                            <div className="font-mono flex items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest gap-1.5 bg-muted/10 py-1 px-2.5 rounded border border-border/40 max-w-full">
                                <span className="truncate">LOC // {vendor.location}</span>
                            </div>
                            {categories[1] && (
                                <div className="font-mono flex items-center text-[10px] font-bold text-primary uppercase tracking-widest gap-1.5 bg-primary/10 py-1 px-2.5 rounded border border-primary/20 max-w-full">
                                    <span className="truncate">CAT // {categories[1]}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-end justify-between pt-3 border-t border-black/5 dark:border-white/5 mt-2">
                            <div className="text-primary font-black text-sm tracking-tight">View profile →</div>
                            <div className="text-[10px] font-bold text-muted-foreground uppercase bg-primary/5 px-2 py-1 rounded-md border border-primary/10">
                                Vendor
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
