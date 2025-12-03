import { ExploreCard, ExploreItem } from './ExploreCard';

interface ExploreGridProps {
    items: ExploreItem[];
    loading?: boolean;
}

export const ExploreGrid = ({ items, loading }: ExploreGridProps) => {
    if (loading) {
        return (
            <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="break-inside-avoid mb-4">
                        <div className="glass-card rounded-xl p-4 h-48 animate-pulse bg-accent/5"></div>
                    </div>
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
        <div className="grid grid-cols-3 gap-0.5 md:gap-1">
            {items.map((item) => (
                <ExploreCard key={`${item.type}-${item.id}`} item={item} />
            ))}
        </div>
    );
};
