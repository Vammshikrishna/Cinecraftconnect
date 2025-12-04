import { useRef } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface FeedSectionProps {
    title: string;
    icon?: LucideIcon;
    linkTo?: string;
    children: React.ReactNode;
    className?: string;
}

const FeedSection = ({ title, icon: Icon, linkTo, children, className }: FeedSectionProps) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const scrollAmount = 320; // Approximate card width
            const newScrollLeft = scrollContainerRef.current.scrollLeft + (direction === 'right' ? scrollAmount : -scrollAmount);
            scrollContainerRef.current.scrollTo({
                left: newScrollLeft,
                behavior: 'smooth'
            });
        }
    };

    return (
        <section className={cn("space-y-4 py-4", className)}>
            <div className="flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                    {Icon && <Icon className="h-5 w-5 text-primary" />}
                    <h2 className="text-lg font-bold tracking-tight">{title}</h2>
                </div>
                {linkTo && (
                    <Link
                        to={linkTo}
                        className="text-sm font-medium text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                    >
                        View All <ArrowRight className="h-4 w-4" />
                    </Link>
                )}
            </div>

            <div className="relative w-full group">
                {/* Previous Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => scroll('left')}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm shadow-lg border border-border opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
                >
                    <ChevronLeft className="h-5 w-5" />
                </Button>

                <div
                    ref={scrollContainerRef}
                    className="flex overflow-x-auto gap-4 px-4 pb-4 scrollbar-hide snap-x snap-mandatory"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {children}
                </div>

                {/* Next Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => scroll('right')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm shadow-lg border border-border opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
                >
                    <ChevronRight className="h-5 w-5" />
                </Button>

                {/* Fade gradients for scroll indication */}
                <div className="absolute left-0 top-0 bottom-4 w-4 bg-gradient-to-r from-background to-transparent pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none" />
            </div>
        </section>
    );
};

export default FeedSection;
