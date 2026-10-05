
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

const PostSkeleton = () => (
  <div className="relative overflow-hidden rounded-xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-card/30 backdrop-blur-md p-4 space-y-4">
    <div className="flex items-center gap-3">
      <EnhancedSkeleton className="h-9 w-9 rounded-full" />
      <div className="space-y-2 flex-1">
        <EnhancedSkeleton className="h-4 w-32" />
        <EnhancedSkeleton className="h-3 w-24" />
      </div>
    </div>
    <div className="space-y-2">
      <EnhancedSkeleton className="h-4 w-full" />
      <EnhancedSkeleton className="h-4 w-5/6" />
    </div>
    <EnhancedSkeleton className="h-[300px] w-full rounded-xl" />
    <div className="flex items-center gap-4 pt-2">
      <EnhancedSkeleton className="h-8 w-16 rounded-full" />
      <EnhancedSkeleton className="h-8 w-16 rounded-full" />
      <EnhancedSkeleton className="h-8 w-16 rounded-full" />
    </div>
  </div>
);

const JobSkeleton = () => (
  <div className="glass-card-premium p-6 md:p-8 space-y-6">
    <div className="flex flex-col md:flex-row justify-between gap-6">
      <div className="flex-grow space-y-4">
        <div className="flex items-center gap-4">
          <EnhancedSkeleton className="h-16 w-16 lg:h-20 lg:w-20 rounded-2xl" />
          <div className="space-y-2">
            <EnhancedSkeleton className="h-8 w-64" />
            <EnhancedSkeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="space-y-2">
          <EnhancedSkeleton className="h-4 w-full" />
          <EnhancedSkeleton className="h-4 w-full" />
        </div>
        <div className="flex gap-3">
          <EnhancedSkeleton className="h-8 w-24 rounded-xl" />
          <EnhancedSkeleton className="h-8 w-24 rounded-xl" />
          <EnhancedSkeleton className="h-8 w-24 rounded-xl" />
        </div>
      </div>
      <div className="shrink-0 flex flex-col items-start md:items-end justify-between md:min-w-[240px]">
        <div className="space-y-2 w-full md:text-right">
          <EnhancedSkeleton className="h-3 w-24 ml-auto" />
          <EnhancedSkeleton className="h-8 w-48 ml-auto" />
        </div>
        <EnhancedSkeleton className="h-14 w-full md:w-56 rounded-2xl mt-6" />
      </div>
    </div>
  </div>
);

const ProjectSkeleton = () => (
  <div className="bg-white dark:bg-card border border-border/50 rounded-[20px] overflow-hidden">
    <EnhancedSkeleton className="aspect-[16/10] w-full" />
    <div className="p-6 space-y-4">
      <div className="space-y-2">
        <EnhancedSkeleton className="h-7 w-3/4" />
        <EnhancedSkeleton className="h-4 w-full" />
        <EnhancedSkeleton className="h-4 w-5/6" />
      </div>
      <div className="flex gap-6 py-1">
        <EnhancedSkeleton className="h-4 w-20" />
        <EnhancedSkeleton className="h-4 w-24" />
      </div>
      <div className="pt-4 border-t border-border/50 flex justify-between items-center">
        <EnhancedSkeleton className="h-3 w-20" />
        <EnhancedSkeleton className="h-8 w-8 rounded-full" />
      </div>
    </div>
  </div>
);

const PageSkeleton = () => (
  <div className="bg-card border border-border rounded-xl overflow-hidden">
    <div className="h-24 bg-gradient-to-br from-primary/10 to-primary/5" />
    <div className="pt-10 px-4 pb-4 space-y-4">
      <div className="flex items-center gap-2">
        <EnhancedSkeleton className="h-6 w-3/4" />
      </div>
      <div className="space-y-2">
        <EnhancedSkeleton className="h-3 w-full" />
        <EnhancedSkeleton className="h-3 w-2/3" />
      </div>
      <div className="flex gap-3">
        <EnhancedSkeleton className="h-4 w-16" />
        <EnhancedSkeleton className="h-4 w-20" />
      </div>
      <EnhancedSkeleton className="h-9 w-full rounded-md" />
    </div>
  </div>
);

const ListingSkeleton = () => (
  <div className="bg-card border border-border rounded-[28px] overflow-hidden">
    <EnhancedSkeleton className="aspect-square w-full" />
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <EnhancedSkeleton className="h-6 w-1/2" />
        <EnhancedSkeleton className="h-6 w-1/4" />
      </div>
      <div className="space-y-2">
        <EnhancedSkeleton className="h-3 w-full" />
        <EnhancedSkeleton className="h-3 w-3/4" />
      </div>
      <div className="flex items-center gap-2">
        <EnhancedSkeleton className="h-5 w-5 rounded-full" />
        <EnhancedSkeleton className="h-3 w-24" />
      </div>
      <EnhancedSkeleton className="h-10 w-full rounded-xl" />
    </div>
  </div>
);

const AnnouncementSkeleton = () => (
  <div className="glass-card-premium min-h-[220px] p-6 flex flex-col space-y-4">
    <div className="flex items-start gap-4">
      <EnhancedSkeleton className="h-12 w-12 rounded-2xl shrink-0" />
      <div className="space-y-2 flex-1">
        <EnhancedSkeleton className="h-5 w-3/4" />
        <EnhancedSkeleton className="h-3 w-20" />
      </div>
    </div>
    <div className="space-y-2 flex-1">
      <EnhancedSkeleton className="h-3 w-full" />
      <EnhancedSkeleton className="h-3 w-full" />
      <EnhancedSkeleton className="h-3 w-2/3" />
    </div>
    <div className="pt-4 border-t border-black/5 dark:border-white/5 flex justify-between items-center mt-auto">
      <EnhancedSkeleton className="h-6 w-32 rounded-md" />
      <EnhancedSkeleton className="h-8 w-8 rounded-full" />
    </div>
  </div>
);

export { 
  EnhancedSkeleton, 
  CraftPageSkeleton, 
  CardSkeleton, 
  PostSkeleton, 
  JobSkeleton, 
  ProjectSkeleton,
  PageSkeleton,
  ListingSkeleton,
  AnnouncementSkeleton
};

