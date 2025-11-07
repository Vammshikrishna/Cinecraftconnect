import { cn } from "@/lib/utils"

function EnhancedSkeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gradient-to-r from-muted via-muted-foreground/20 to-muted",
        "bg-[length:200%_100%] animate-[shimmer_2s_infinite]",
        className
      )}
      {...props}
    />
  )
}

function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3 p-6 border rounded-lg bg-card", className)}>
      <EnhancedSkeleton className="h-4 w-3/4" />
      <EnhancedSkeleton className="h-4 w-1/2" />
      <div className="space-y-2">
        <EnhancedSkeleton className="h-3 w-full" />
        <EnhancedSkeleton className="h-3 w-2/3" />
      </div>
      <div className="flex space-x-2 pt-2">
        <EnhancedSkeleton className="h-8 w-20" />
        <EnhancedSkeleton className="h-8 w-16" />
      </div>
    </div>
  )
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <EnhancedSkeleton className="h-10 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex space-x-4">
          <EnhancedSkeleton className="h-8 flex-1" />
          <EnhancedSkeleton className="h-8 w-24" />
          <EnhancedSkeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  )
}

export { EnhancedSkeleton, CardSkeleton, TableSkeleton }