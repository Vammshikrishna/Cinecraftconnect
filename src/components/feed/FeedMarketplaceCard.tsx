import { ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';

interface FeedMarketplaceCardProps {
    item: {
        id: string;
        title: string;
        price_per_day?: number | null;
        price_per_week?: number | null;
        images?: string[] | null;
        category?: string;
    };
}

const FeedMarketplaceCard = ({ item }: FeedMarketplaceCardProps) => {
    const imageUrl = item.images && item.images.length > 0 ? item.images[0] : null;
    const price = item.price_per_day || item.price_per_week;
    const period = item.price_per_day ? '/day' : (item.price_per_week ? '/week' : '');
    const hasPrice = price !== null && price !== undefined;

    return (
        <Link to={`/marketplace/${item.id}`} className="block h-full cursor-pointer">
            <div className="relative overflow-hidden rounded-xl border border-border bg-card hover:shadow-lg hover:border-primary/50 transition-all duration-300 h-full flex flex-col group">
                <div className="aspect-square w-full relative overflow-hidden bg-secondary/30">
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt={item.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground group-hover:bg-secondary/50 transition-colors">
                            <ShoppingBag className="h-12 w-12 opacity-20 group-hover:opacity-40 transition-opacity" />
                        </div>
                    )}
                    {hasPrice && (
                        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white text-xs px-2.5 py-1.5 rounded-full font-bold shadow-sm">
                            ${price?.toLocaleString()}{period}
                        </div>
                    )}
                </div>
                <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-bold text-base line-clamp-1 group-hover:text-primary transition-colors mb-1">
                        {item.title}
                    </h3>
                    {item.category && (
                        <div className="flex items-center justify-between mt-auto pt-2">
                            <span className="text-xs font-medium text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full capitalize">
                                {item.category}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
};

export default FeedMarketplaceCard;
