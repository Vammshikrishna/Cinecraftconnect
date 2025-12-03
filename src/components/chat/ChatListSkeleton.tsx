import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';

export const ChatListSkeleton = () => (
    <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b border-border/50 last:border-0">
                <EnhancedSkeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                    <EnhancedSkeleton className="h-4 w-1/3" />
                    <EnhancedSkeleton className="h-3 w-1/2" />
                </div>
            </div>
        ))}
    </div>
);
