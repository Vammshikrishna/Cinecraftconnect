import { ExploreCard, ExploreItem } from './ExploreCard';

interface ExploreGridProps {
    items: ExploreItem[];
    loading?: boolean;
}

export const ExploreGrid = ({ items, loading }: ExploreGridProps) => {
    if (loading) {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 md:gap-2.5 pb-20 w-full max-w-full overflow-hidden">
                {[...Array(16)].map((_, i) => (
                    <div
                        key={i}
                        className="aspect-[3/4.5] lg:aspect-[3/4] bg-white/5 animate-pulse rounded-sm md:rounded-md"
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

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 md:gap-2.5 auto-rows-fr pb-32 w-full max-w-full overflow-hidden">
            {items.map((item) => {
                return (
                    <div
                        key={`${item.type}-${item.id}`}
                        className="col-span-1 row-span-1 transition-transform duration-500 hover:z-50 w-full max-w-full overflow-hidden"
                    >
                        <ExploreCard item={item} />
                    </div>
                );
            })}
        </div>
    );
};

