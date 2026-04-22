import { Link } from 'react-router-dom';
import { Vendor } from '@/types/marketplace';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Star, CheckCircle2, Phone, Mail } from 'lucide-react';

interface VendorCardProps {
    vendor: Vendor;
}

export const VendorCard = ({ vendor }: VendorCardProps) => {
    const logoUrl = vendor.logo_url || undefined;
    const averageRating = vendor.average_rating || 0;
    const reviewCount = vendor.review_count || 0;

    return (
        <Link to={`/vendors/${vendor.id}`} className="no-underline block group h-full">
            <div className="glass-card-premium h-full p-6 flex flex-col gap-5 transition-transform duration-500 hover:-translate-y-2">
                {/* Header: Logo and Verified */}
                <div className="flex items-start justify-between">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-2xl border-4 border-background shadow-xl ring-1 ring-black/5 dark:ring-white/10 bg-background overflow-hidden transform group-hover:scale-105 transition-transform duration-500">
                            <Avatar className="h-full w-full rounded-none">
                                <AvatarImage src={logoUrl} className="object-cover" />
                                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-black uppercase">
                                    {vendor.business_name?.[0]}
                                </AvatarFallback>
                            </Avatar>
                        </div>
                        {vendor.is_verified && (
                            <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground p-1 rounded-full shadow-lg border-2 border-background animate-in zoom-in duration-500">
                                <CheckCircle2 size={14} className="fill-current" />
                            </div>
                        )}
                    </div>
                    
                    {reviewCount > 0 && (
                        <div className="px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-1.5 transition-all group-hover:bg-yellow-500/20">
                            <Star size={12} className="text-yellow-500 fill-yellow-500" />
                            <span className="text-[11px] font-black text-yellow-600 dark:text-yellow-400">{averageRating.toFixed(1)}</span>
                        </div>
                    )}
                </div>

                {/* Info Section */}
                <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap gap-1.5">
                        {vendor.category.slice(0, 2).map((cat, index) => (
                            <Badge key={index} variant="secondary" className="bg-primary/5 text-primary border-primary/10 text-[9px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-md">
                                {cat}
                            </Badge>
                        ))}
                    </div>

                    <h3 className="font-black text-xl tracking-tight text-foreground group-hover:text-primary transition-colors duration-300 leading-tight">
                        {vendor.business_name}
                    </h3>

                    <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2 md:line-clamp-3 font-medium">
                        {vendor.description}
                    </p>
                </div>

                {/* Location Footer */}
                <div className="flex items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest gap-2 bg-black/5 dark:bg-white/5 py-1.5 px-3 rounded-xl border border-black/5 dark:border-white/5">
                    <MapPin size={12} className="text-primary/60" />
                    <span className="truncate">{vendor.location}</span>
                </div>

                {/* Contact Divider */}
                <div className="pt-4 border-t border-black/5 dark:border-white/5 grid grid-cols-1 gap-2">
                    <div className="flex items-center gap-3 group/contact transition-colors">
                        <div className="w-7 h-7 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center text-primary group-hover/contact:bg-primary group-hover/contact:text-primary-foreground transition-all duration-300">
                            <Phone size={14} />
                        </div>
                        <span className="text-[11px] font-bold text-muted-foreground/90 group-hover/contact:text-foreground transition-colors tracking-tight">{vendor.phone}</span>
                    </div>
                    <div className="flex items-center gap-3 group/contact transition-colors">
                        <div className="w-7 h-7 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center text-primary group-hover/contact:bg-primary group-hover/contact:text-primary-foreground transition-all duration-300">
                            <Mail size={14} />
                        </div>
                        <span className="text-[11px] font-bold text-muted-foreground/90 group-hover/contact:text-foreground transition-colors tracking-tight truncate">{vendor.email}</span>
                    </div>
                </div>

            </div>
        </Link>
    );
};
