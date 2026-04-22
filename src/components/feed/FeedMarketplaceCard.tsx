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
            <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-xl hover:shadow-[0_8px_30px_-5px_rgba(var(--primary),0.2)] hover:-translate-y-1 hover:border-primary/50 transition-all duration-500 h-full flex flex-col group p-1.5">
                <div className="aspect-square w-full relative overflow-hidden rounded-[18px] bg-black/5 dark:bg-white/5 group-hover:shadow-inner transition-all duration-500">
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
                <div className="p-4 flex flex-col flex-1 px-3">
                    <h3 className="font-bold text-sm tracking-tight line-clamp-2 group-hover:text-primary transition-colors mb-1.5">
                        {item.title}
                    </h3>
                    {item.category && (
                        <div className="flex items-center justify-between mt-auto pt-2">
                            <span className="text-[10px] font-bold tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded-full uppercase border border-primary/20">
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
