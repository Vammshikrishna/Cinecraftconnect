import { ExploreCard, ExploreItem } from './ExploreCard';

interface ExploreGridProps {
    items: ExploreItem[];
    loading?: boolean;
}

export const ExploreGrid = ({ items, loading }: ExploreGridProps) => {
    if (loading) {
        return (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 md:gap-2 pb-20">
                {[...Array(16)].map((_, i) => (
                    <div
                        key={i}
                        className={`aspect-[3/4.5] bg-white/5 animate-pulse rounded-sm md:rounded-md ${i % 10 === 0 ? 'col-span-2 row-span-2' : ''
                            }`}
                    />
                ))}
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="text-center py-24 border border-dashed border-white/10 rounded-3xl bg-white/5 backdrop-blur-sm">
                <p className="text-muted-foreground font-black uppercase tracking-widest text-sm">No discovery items found.</p>
            </div>
        );
    }

    /**
     * Instagram-style Mosaic Logic:
     * We want some items to be larger (2x2).
     * Every 10 items, we make one a featured item.
     */
    return (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 md:gap-2 auto-rows-fr pb-32">
            {items.map((item, index) => {
                // Featured logic: every 10th item is 2x2
                const isFeatured = index % 10 === 0 && index !== 0;

                return (
                    <div
                        key={`${item.type}-${item.id}`}
                        className={`${isFeatured
                                ? 'col-span-2 row-span-2'
                                : 'col-span-1 row-span-1'
                            } transition-transform duration-500 hover:z-50`}
                    >
                        <ExploreCard item={item} />
                    </div>
                );
            })}
        </div>
    );
};

