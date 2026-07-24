import { useState } from 'react';
import { EnhancedSkeleton, PostSkeleton } from '@/components/ui/enhanced-skeleton';
import SEO from '@/components/common/SEO';
import HomeTab from '@/components/feed/HomeTab';

export const FeedSkeleton = () => (
    <div className="flex justify-center gap-6 lg:gap-10 max-w-[1280px] mx-auto pb-20 pt-2 md:pt-6">
        {/* Main Feed Column */}
        <div className="w-full max-w-[480px] space-y-6 px-4 sm:px-0">
            {/* Create Post Widget Skeleton */}
            <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-card/30 backdrop-blur-md p-4 flex items-center gap-3">
                <EnhancedSkeleton className="h-10 w-10 rounded-full" />
                <EnhancedSkeleton className="h-10 flex-1 rounded-xl" />
            </div>

            {/* Post Cards Skeletons */}
            <div className="space-y-6">
                <PostSkeleton />
                <PostSkeleton />
                <PostSkeleton />
            </div>
        </div>

        {/* Sidebar Skeleton (Visible on lg screens) */}
        <aside className="hidden lg:flex flex-col w-[300px] gap-5 sticky top-24 h-fit p-5 rounded-2xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-card/30 backdrop-blur-md shadow-sm">
            {/* Mini Profile Skeleton */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <EnhancedSkeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1.5">
                        <EnhancedSkeleton className="h-3.5 w-28" />
                        <EnhancedSkeleton className="h-2.5 w-20" />
                    </div>
                </div>
                <EnhancedSkeleton className="h-4 w-10" />
            </div>

            {/* Suggestions Header Skeleton */}
            <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                    <EnhancedSkeleton className="h-3 w-32" />
                    <EnhancedSkeleton className="h-3 w-12" />
                </div>
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <EnhancedSkeleton className="h-8 w-8 rounded-full" />
                            <div className="space-y-1">
                                <EnhancedSkeleton className="h-3 w-24" />
                                <EnhancedSkeleton className="h-2.5 w-16" />
                            </div>
                        </div>
                        <EnhancedSkeleton className="h-5 w-14 rounded-full" />
                    </div>
                ))}
            </div>
        </aside>
    </div>
);

const Feed = ({ openCreate = false }: { openCreate?: boolean }) => {
    const [postRatings, setPostRatings] = useState<{ [postId: string]: number }>({});

    const handleRate = (postId: string | number, rating: number) => {
        setPostRatings(curr => ({ ...curr, [String(postId)]: rating }));
    };

    return (
        <div className="min-h-screen bg-background pt-[68px] md:pt-20 relative">
            <SEO 
                title="Feed" 
                description="Explore the latest updates from the entertainment world. Follow creators, filmmakers, and industry professionals in your CineCraft feed." 
            />
            <div className="w-full md:container mx-auto px-0 md:px-8 pb-36 animate-fade-in">
                <div className="w-full">
                    <HomeTab postRatings={postRatings} onRate={handleRate} openCreate={openCreate} />
                </div>
            </div>
        </div>
    );
};

export default Feed;
