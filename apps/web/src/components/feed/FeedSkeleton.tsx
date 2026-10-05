import { EnhancedSkeleton, PostSkeleton } from '@/components/ui/enhanced-skeleton';

export const FeedSkeleton = () => (
    <div className="flex justify-center gap-6 lg:gap-10 max-w-[1280px] mx-auto pb-20 pt-2 md:pt-6">
        {/* Main Feed Column */}
        <div className="w-full max-w-[480px] space-y-4 sm:space-y-6 px-4 sm:px-0">
            {/* Create Post Widget Skeleton */}
            <div className="rounded-xl border border-border/60 bg-card p-3 flex items-center gap-3">
                <EnhancedSkeleton className="h-8 w-8 rounded-full" />
                <EnhancedSkeleton className="h-8 flex-1 rounded-xl" />
            </div>

            {/* Post Cards Skeletons */}
            <div className="space-y-4 sm:space-y-6">
                <PostSkeleton />
                <PostSkeleton />
                <PostSkeleton />
            </div>
        </div>

        {/* Sidebar Skeleton (Visible on lg screens) */}
        <aside className="hidden lg:flex flex-col w-[300px] gap-5 sticky top-24 h-fit py-2 px-1 border-none bg-transparent shadow-none">
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
