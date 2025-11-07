
import { cn } from "@/lib/utils";

function EnhancedSkeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-shimmer bg-cinesphere-dark/50 rounded-md bg-[linear-gradient(110deg,#0f0f14,45%,#202028,55%,#0f0f14)] bg-[length:200%_100%]", className)}
      {...props}
    />
  );
}

const CraftPageSkeleton = () => (
  <div className="min-h-screen bg-cinesphere-dark pt-24 pb-16 px-4 md:px-8">
    <div className="max-w-6xl mx-auto">
      {/* Header Skeleton */}
      <div className="glass-card rounded-xl p-8 mb-12">
        <EnhancedSkeleton className="h-10 w-1/3 mx-auto mb-4" />
        <EnhancedSkeleton className="h-6 w-2/3 mx-auto mb-6" />
        <div className="max-w-xl mx-auto">
          <EnhancedSkeleton className="h-12 w-full" />
        </div>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8">
        {/* Left Column Skeleton */}
        <div className="md:col-span-2 space-y-6">
          <div className="flex items-center justify-between mb-6">
            <EnhancedSkeleton className="h-8 w-48" />
            <EnhancedSkeleton className="h-10 w-24" />
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <EnhancedSkeleton className="h-16 w-16 rounded-full" />
                <div className="flex-1 space-y-3">
                  <EnhancedSkeleton className="h-6 w-1/2" />
                  <EnhancedSkeleton className="h-4 w-1/4" />
                  <EnhancedSkeleton className="h-4 w-full" />
                  <EnhancedSkeleton className="h-4 w-5/6" />
                  <div className="flex gap-2 pt-2">
                    <EnhancedSkeleton className="h-9 w-20" />
                    <EnhancedSkeleton className="h-9 w-24" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Right Column Skeleton */}
        <div className="space-y-8">
          <div>
            <EnhancedSkeleton className="h-8 w-56 mb-6" />
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="glass-card rounded-xl p-4 space-y-2">
                  <EnhancedSkeleton className="h-5 w-3/4" />
                  <EnhancedSkeleton className="h-4 w-1/3" />
                  <EnhancedSkeleton className="h-4 w-full" />
                </div>
              ))}
              <EnhancedSkeleton className="h-10 w-full" />
            </div>
          </div>
          <div>
            <EnhancedSkeleton className="h-8 w-40 mb-4" />
            <div className="glass-card rounded-xl p-4 space-y-3">
              <EnhancedSkeleton className="h-5 w-3/4" />
              <EnhancedSkeleton className="h-5 w-1/2" />
              <EnhancedSkeleton className="h-5 w-2/3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const CardSkeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("glass-card rounded-xl p-6", className)} {...props}>
      <div className="flex items-start gap-4">
        <EnhancedSkeleton className="h-16 w-16 rounded-full" />
        <div className="flex-1 space-y-3">
          <EnhancedSkeleton className="h-6 w-1/2" />
          <EnhancedSkeleton className="h-4 w-1/4" />
          <EnhancedSkeleton className="h-4 w-full" />
          <EnhancedSkeleton className="h-4 w-5/6" />
          <div className="flex gap-2 pt-2">
            <EnhancedSkeleton className="h-9 w-20" />
            <EnhancedSkeleton className="h-9 w-24" />
          </div>
        </div>
      </div>
    </div>
  );
  

export { EnhancedSkeleton, CraftPageSkeleton, CardSkeleton };
