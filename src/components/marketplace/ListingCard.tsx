import { Link } from 'react-router-dom';
import { MarketplaceListing } from '@/types/marketplace';
import { Badge } from '@/components/ui/badge';
import { MapPin, Star, User } from 'lucide-react';

interface ListingCardProps {
    listing: MarketplaceListing;
}

export const ListingCard = ({ listing }: ListingCardProps) => {
    const primaryImage = listing.images && listing.images.length > 0
        ? listing.images[0]
        : '/placeholder-image.jpg';

    const averageRating = listing.average_rating || 0;
    const reviewCount = listing.review_count || 0;

    return (
        <Link to={`/marketplace/${listing.id}`}>
            <div className="glass-card rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 group">
                {/* Image */}
                <div className="relative aspect-video overflow-hidden bg-gray-800">
                    <img
                        src={primaryImage}
                        alt={listing.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = '/placeholder-image.jpg';
                        }}
                    />
                    <div className="absolute top-3 right-3">
                        <Badge variant="secondary" className="bg-black/50 backdrop-blur-sm">
                            {listing.category}
                        </Badge>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4">
                    <h3 className="font-semibold text-lg mb-2 line-clamp-1 group-hover:text-primary transition-colors">
                        {listing.title}
                    </h3>

                    <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                        {listing.description}
                    </p>

                    {/* Location */}
                    <div className="flex items-center text-sm text-gray-300 mb-3">
                        <MapPin size={14} className="mr-1 text-gray-400" />
                        {listing.location}
                    </div>

                    {/* Rating */}
                    {reviewCount > 0 && (
                        <div className="flex items-center text-sm mb-3">
                            <Star size={14} className="mr-1 text-yellow-500 fill-yellow-500" />
                            <span className="font-medium">{averageRating.toFixed(1)}</span>
                            <span className="text-gray-400 ml-1">({reviewCount} reviews)</span>
                        </div>
                    )}

                    {/* Owner */}
                    {listing.profiles && (
                        <div className="flex items-center text-sm text-gray-400 mb-3">
                            <User size={14} className="mr-1" />
                            {listing.profiles.username || listing.profiles.full_name || 'Anonymous'}
                        </div>
                    )}

                    {/* Price */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                        <div className="flex items-center text-primary font-semibold">
                            <span className="mr-0.5">₹</span>
                            <span>{listing.price_per_day}</span>
                            <span className="text-sm text-gray-400 ml-1">/day</span>
                        </div>
                        {listing.price_per_week && (
                            <div className="text-sm text-gray-400">
                                ₹{listing.price_per_week}/week
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Link>
    );
};
