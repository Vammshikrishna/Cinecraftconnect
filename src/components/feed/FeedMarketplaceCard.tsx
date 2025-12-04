import { ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';

interface FeedMarketplaceCardProps {
    item: {
        id: string;
        title: string;
        price: number;
        image_url?: string | null;
        category?: string;
    };
}

const FeedMarketplaceCard = ({ item }: FeedMarketplaceCardProps) => {
    return (
        <Link to={`/marketplace/${item.id}`} className="block h-full">
            <div className="relative overflow-hidden rounded-xl border border-border bg-card hover:shadow-md transition-all duration-300 h-full flex flex-col group">
                <div className="aspect-square w-full relative overflow-hidden bg-muted">
                    {item.image_url ? (
                        <img
                            src={item.image_url}
                            alt={item.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <ShoppingBag className="h-10 w-10 opacity-20" />
                        </div>
                    )}
                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded font-bold">
                        ${item.price}
                    </div>
                </div>
                <div className="p-3 flex flex-col flex-1">
                    <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">
                        {item.title}
                    </h3>
                    {item.category && (
                        <p className="text-xs text-muted-foreground mt-1 capitalize">
                            {item.category}
                        </p>
                    )}
                </div>
            </div>
        </Link>
    );
};

export default FeedMarketplaceCard;
