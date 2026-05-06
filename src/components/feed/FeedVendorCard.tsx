import { Building2, MapPin, X } from 'lucide-react';
import { Link } from 'react-router-dom';

interface FeedVendorCardProps {
    vendor: {
        id: string;
        business_name: string;
        logo_url?: string | null;
        category?: string;
        location?: string;
    };
    onDismiss?: (id: string) => void;
}

const FeedVendorCard = ({ vendor, onDismiss }: FeedVendorCardProps) => {
    return (
        <div className="relative group h-full">
            {onDismiss && (
                <button 
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDismiss(vendor.id);
                    }}
                    className="absolute top-4 right-4 z-30 h-7 w-7 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all backdrop-blur-md border border-white/10"
                    title="Dismiss suggestion"
                >
                    <X size={12} strokeWidth={3} />
                </button>
            )}
            <Link to={`/vendors/${vendor.id}`} className="block h-full">
                <div className="group/card relative overflow-hidden rounded-[24px] border border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-xl hover:shadow-[0_8px_30px_-5px_rgba(var(--primary),0.2)] hover:-translate-y-1 hover:border-primary/50 transition-all duration-500 h-full flex flex-col items-center text-center p-0">
                    {/* Decorative Header */}
                    <div className="w-full h-16 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border-b border-border/10 group-hover:from-primary/30 transition-all duration-500" />

                    <div className="px-4 pb-5 pt-0 w-full flex flex-col items-center flex-1">
                        <div className="-mt-8 mb-3 relative group/avatar">
                            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-500" />
                            <div className="w-16 h-16 rounded-full overflow-hidden bg-background border-4 border-background shadow-xl group-hover/avatar:scale-105 transition-transform duration-500 ring-1 ring-border/50 relative z-10">
                                {vendor.logo_url ? (
                                    <img
                                        src={vendor.logo_url}
                                        alt={vendor.business_name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-muted/50">
                                        <Building2 className="h-7 w-7 opacity-30" />
                                    </div>
                                )}
                            </div>
                        </div>

                        <h3 className="font-bold text-sm tracking-tight line-clamp-1 group-hover:text-primary transition-colors mb-2 w-full">
                            {vendor.business_name}
                        </h3>

                        {vendor.category && (
                            <span className="text-[10px] uppercase font-black tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded-full mb-3 border border-primary/20">
                                {vendor.category}
                            </span>
                        )}

                        {vendor.location && (
                            <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-muted-foreground mt-auto bg-black/5 dark:bg-white/5 py-1.5 px-3 rounded-full w-full">
                                <MapPin className="h-3.5 w-3.5 text-primary/70" />
                                <span className="line-clamp-1">{vendor.location}</span>
                            </div>
                        )}
                    </div>
                </div>
            </Link>
        </div>
    );
};

export default FeedVendorCard;
