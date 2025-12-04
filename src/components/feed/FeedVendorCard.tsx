import { Building2, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

interface FeedVendorCardProps {
    vendor: {
        id: string;
        business_name: string;
        logo_url?: string | null;
        category?: string;
        location?: string;
    };
}

const FeedVendorCard = ({ vendor }: FeedVendorCardProps) => {
    return (
        <Link to={`/vendors/${vendor.id}`} className="block h-full">
            <div className="relative overflow-hidden rounded-xl border border-border bg-card hover:shadow-md transition-all duration-300 h-full flex flex-col group p-4 items-center text-center">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-muted mb-3 border-2 border-border group-hover:border-primary transition-colors">
                    {vendor.logo_url ? (
                        <img
                            src={vendor.logo_url}
                            alt={vendor.business_name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <Building2 className="h-8 w-8 opacity-20" />
                        </div>
                    )}
                </div>

                <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors mb-1">
                    {vendor.business_name}
                </h3>

                {vendor.category && (
                    <span className="text-[10px] uppercase font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full mb-2">
                        {vendor.category}
                    </span>
                )}

                {vendor.location && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-auto">
                        <MapPin className="h-3 w-3" />
                        <span className="line-clamp-1">{vendor.location}</span>
                    </div>
                )}
            </div>
        </Link>
    );
};

export default FeedVendorCard;
