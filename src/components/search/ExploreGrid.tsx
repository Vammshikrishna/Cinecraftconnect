import { ExploreCard, ExploreItem } from './ExploreCard';

interface ExploreGridProps {
    items: ExploreItem[];
    loading?: boolean;
}

export const ExploreGrid = ({ items, loading }: ExploreGridProps) => {
    if (loading) {
        return (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-[2px] pb-20">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="aspect-[4/5] bg-white/5 animate-pulse" />
                ))}
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <p>No explore items found.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-[2px]">
            {items.map((item) => (
                <ExploreCard key={`${item.type}-${item.id}`} item={item} />
            ))}
        </div>
    );
};
