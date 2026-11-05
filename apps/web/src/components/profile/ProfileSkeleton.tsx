import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';

/** The loading shape of a profile page: the same two-column header, the tab row and a grid of cards. */
export const ProfileSkeleton = ({ withBackRow = false }: { withBackRow?: boolean }) => (
  <div aria-busy="true" aria-label="Loading profile">
    {withBackRow && (
      <div className="flex items-center justify-between gap-3 mb-6">
        <EnhancedSkeleton className="h-9 w-24 rounded-full" />
        <div className="flex gap-2">
          <EnhancedSkeleton className="h-9 w-9 rounded-full" />
          <EnhancedSkeleton className="h-9 w-9 rounded-full" />
          <EnhancedSkeleton className="h-9 w-9 rounded-full" />
        </div>
      </div>
    )}

    <div className="rounded-3xl border border-border/60 bg-card overflow-hidden mb-8">
      <div className="h-1.5 bg-muted" />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* identity */}
        <div className="p-6 md:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 md:gap-8">
          <EnhancedSkeleton className="h-28 w-28 md:h-32 md:w-32 rounded-full shrink-0" />
          <div className="flex-1 w-full space-y-3 flex flex-col items-center sm:items-start">
            <EnhancedSkeleton className="h-8 w-64 max-w-full" />
            <EnhancedSkeleton className="h-4 w-32" />
            <EnhancedSkeleton className="h-4 w-72 max-w-full" />
            <EnhancedSkeleton className="h-6 w-16 rounded-full" />
            <div className="w-full max-w-2xl space-y-2 pt-1">
              <EnhancedSkeleton className="h-4 w-full" />
              <EnhancedSkeleton className="h-4 w-11/12" />
              <EnhancedSkeleton className="h-4 w-2/3" />
            </div>
            <div className="flex gap-2 pt-1">
              {[1, 2, 3].map((i) => <EnhancedSkeleton key={i} className="h-9 w-9 rounded-full" />)}
            </div>
          </div>
        </div>

        {/* numbers and buttons */}
        <div className="border-t lg:border-t-0 lg:border-l border-border/50 bg-muted/20 p-6 flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <EnhancedSkeleton className="h-7 w-10" />
                <EnhancedSkeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-auto">
            <EnhancedSkeleton className="h-9 w-28 rounded-full" />
            <EnhancedSkeleton className="h-9 w-9 rounded-lg" />
            <EnhancedSkeleton className="h-9 w-9 rounded-lg" />
            <EnhancedSkeleton className="h-9 w-9 rounded-lg" />
          </div>
        </div>
      </div>
    </div>

    <div className="flex gap-3 mb-6 overflow-hidden">
      {[1, 2, 3, 4, 5, 6].map((i) => <EnhancedSkeleton key={i} className="h-10 w-28 rounded-full shrink-0" />)}
    </div>
    <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-1 md:gap-3">
      {Array.from({ length: 10 }).map((_, i) => <EnhancedSkeleton key={i} className="aspect-square rounded-none md:rounded-sm" />)}
    </div>
  </div>
);
