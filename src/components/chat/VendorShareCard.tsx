
import { Link } from 'react-router-dom';
import { Store, MapPin, Star } from 'lucide-react';


interface VendorShareCardProps {
    vendorId: string;
    name: string;
    logoUrl?: string;
    category?: string;
    location?: string;
    description?: string;
}

export const VendorShareCard = ({ vendorId, name, logoUrl, category, location, description }: VendorShareCardProps) => {
    return (
        <Link to={`/vendors/${vendorId}`} className="block w-full max-w-[280px] bg-card border border-border rounded-[22px] overflow-hidden transition-opacity hover:opacity-95 no-underline">
            {/* Header / Logo */}
            <div className="relative aspect-video bg-muted/50 flex items-center justify-center overflow-hidden">
                {logoUrl ? (
                    <img
                        src={logoUrl}
                        alt={name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Store className="h-8 w-8" />
                        <span className="text-xs">Vendor Profile</span>
                    </div>
                )}
                {category && (
                    <div className="absolute top-2 left-2">
                        <span className="bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
                            {category}
                        </span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-base leading-tight text-foreground line-clamp-1">{name}</h4>
                </div>

                {location && (
                    <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{location}</span>
                    </div>
                )}

                {description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {description}
                    </p>
                )}

                <div className="pt-2 flex items-center justify-between">
                    <div className="flex items-center gap-0.5 text-yellow-500">
                        <Star className="h-3 w-3 fill-current" />
                        <span className="text-[11px] font-bold">New</span>
                    </div>
                    <span className="text-[11px] font-semibold text-primary">View Profile</span>
                </div>
            </div>
        </Link>
    );
};
