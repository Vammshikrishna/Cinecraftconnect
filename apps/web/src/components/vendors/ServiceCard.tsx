import { useAppNavigation } from '@/contexts/NavigationContext';
import { LazyImage } from '@/components/performance/LazyImage';
import { BadgeCheck } from 'lucide-react';

interface ServiceCardProps {
    service: {
        id: string;
        title: string;
        description: string;
        day_rate: number;
        coverage_area: string;
        min_booking_days?: number | null;
        crew_capacity?: number | null;
        production_types?: string[] | null;
        images?: string[] | null;
        vendor?: { business_name: string; logo_url: string | null; is_verified: boolean | null } | null;
    };
}

/** Same card as the gear/location listings (image on top, serif title, mono meta chips, price footer), for a vendor service package. */
export const ServiceCard = ({ service }: ServiceCardProps) => {
    const { push } = useAppNavigation();
    const image = service.images?.[0] || service.vendor?.logo_url || undefined;
    const types = service.production_types || [];

    return (
        <div onClick={() => push(`/vendors/services/${service.id}`)} className="no-underline block group h-full cursor-pointer">
            <div className="glass-card-premium h-full flex flex-col transition-transform duration-500 hover:-translate-y-2">
                {/* Image Section */}
                <div className="relative aspect-video overflow-hidden bg-muted flex-shrink-0">
                    {image ? (
                        <LazyImage
                            src={image}
                            alt={service.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center">
                            <div className="text-muted-foreground/30 font-black uppercase tracking-widest text-[10px]">No Image</div>
                        </div>
                    )}

                    <div className="absolute top-3 right-3 flex items-center gap-2 shadow-lg">
                        {service.vendor?.is_verified && (
                            <div className="px-2.5 py-1 rounded-full bg-primary/90 backdrop-blur-md border border-white/20 text-[9px] font-black text-primary-foreground uppercase tracking-[0.1em] flex items-center gap-1 shadow-lg">
                                <BadgeCheck size={10} /> VERIFIED
                            </div>
                        )}
                        <div className="px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-md border border-white/20 text-[9px] font-black text-foreground uppercase tracking-[0.1em]">
                            {types[0] || 'Service'}
                        </div>
                    </div>
                </div>

                {/* Content Section */}
                <div className="p-5 md:p-6 flex flex-col flex-1 gap-4">
                    <div className="space-y-1">
                        <h3 className="font-serif text-xl md:text-2xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors duration-300 line-clamp-2 leading-tight">
                            {service.title}
                        </h3>
                        <p className="text-[11px] md:text-xs text-muted-foreground/80 leading-relaxed line-clamp-2 font-medium">
                            {service.description}
                        </p>
                    </div>

                    <div className="space-y-2.5 mt-auto pt-2">
                        <div className="flex flex-wrap items-center gap-2 mt-auto">
                            <div className="font-mono flex items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest gap-1.5 bg-muted/10 py-1 px-2.5 rounded border border-border/40 max-w-full">
                                <span className="truncate">LOC // {service.coverage_area}</span>
                            </div>
                            {service.vendor?.business_name && (
                                <div className="font-mono flex items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest gap-1.5 bg-muted/10 py-1 px-2.5 rounded border border-border/40 max-w-full">
                                    <span className="truncate">VENDOR // {service.vendor.business_name}</span>
                                </div>
                            )}
                            {service.crew_capacity ? (
                                <div className="font-mono flex items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest gap-1.5 bg-muted/10 py-1 px-2.5 rounded border border-border/40 max-w-full">
                                    <span className="truncate">CREW // UP TO {service.crew_capacity}</span>
                                </div>
                            ) : null}
                        </div>

                        {/* Price footer */}
                        <div className="flex items-end justify-between pt-3 border-t border-black/5 dark:border-white/5 mt-2">
                            <div className="flex items-baseline text-primary font-black">
                                <span className="text-sm mr-0.5 opacity-60">₹</span>
                                <span className="text-2xl tracking-tighter">{service.day_rate}</span>
                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1.5 opacity-60">/ Day</span>
                            </div>
                            {service.min_booking_days && service.min_booking_days > 1 ? (
                                <div className="text-[10px] font-bold text-muted-foreground uppercase bg-primary/5 px-2 py-1 rounded-md border border-primary/10">
                                    Min {service.min_booking_days} days
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
