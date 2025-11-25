import { Link } from 'react-router-dom';
import { Vendor } from '@/types/marketplace';
import { Badge } from '@/components/ui/badge';
import { MapPin, Star, CheckCircle2, Phone, Mail } from 'lucide-react';

interface VendorCardProps {
    vendor: Vendor;
}

export const VendorCard = ({ vendor }: VendorCardProps) => {
    const logoUrl = vendor.logo_url || '/placeholder-logo.jpg';
    const averageRating = vendor.average_rating || 0;
    const reviewCount = vendor.review_count || 0;

    return (
        <Link to={`/vendors/${vendor.id}`}>
            <div className="glass-card rounded-xl p-6 hover:shadow-xl transition-all duration-300 group">
                {/* Logo and Verified Badge */}
                <div className="flex items-start justify-between mb-4">
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                        <img
                            src={logoUrl}
                            alt={vendor.business_name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = '/placeholder-logo.jpg';
                            }}
                        />
                    </div>
                    {vendor.is_verified && (
                        <Badge variant="secondary" className="bg-primary/20 text-primary gap-1">
                            <CheckCircle2 size={14} />
                            Verified
                        </Badge>
                    )}
                </div>

                {/* Business Name */}
                <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
                    {vendor.business_name}
                </h3>

                {/* Description */}
                <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                    {vendor.description}
                </p>

                {/* Categories */}
                <div className="flex flex-wrap gap-1 mb-3">
                    {vendor.category.slice(0, 2).map((cat, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                            {cat}
                        </Badge>
                    ))}
                    {vendor.category.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                            +{vendor.category.length - 2}
                        </Badge>
                    )}
                </div>

                {/* Location */}
                <div className="flex items-center text-sm text-gray-300 mb-3">
                    <MapPin size={14} className="mr-1 text-gray-400" />
                    {vendor.location}
                </div>

                {/* Rating */}
                {reviewCount > 0 && (
                    <div className="flex items-center text-sm mb-3">
                        <Star size={14} className="mr-1 text-yellow-500 fill-yellow-500" />
                        <span className="font-medium">{averageRating.toFixed(1)}</span>
                        <span className="text-gray-400 ml-1">({reviewCount} reviews)</span>
                    </div>
                )}

                {/* Contact Info */}
                <div className="pt-3 border-t border-gray-700 space-y-2">
                    <div className="flex items-center text-sm text-gray-400">
                        <Phone size={14} className="mr-2" />
                        {vendor.phone}
                    </div>
                    <div className="flex items-center text-sm text-gray-400">
                        <Mail size={14} className="mr-2" />
                        {vendor.email}
                    </div>
                </div>
            </div>
        </Link>
    );
};
