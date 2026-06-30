import React from 'react';
import { useCachedMedia } from '@/hooks/useCachedMedia';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface CachedVideoProps extends Omit<React.VideoHTMLAttributes<HTMLVideoElement>, 'src'> {
  src?: string | null;
  skeletonClassName?: string;
}

export const CachedVideo = React.forwardRef<HTMLVideoElement, CachedVideoProps>(
  ({ src, skeletonClassName, className, ...props }, ref) => {
    const { cachedUrl, isLoading, error } = useCachedMedia(src);

    if (isLoading) {
      return (
        <Skeleton 
          className={cn("w-full h-full bg-muted animate-pulse", skeletonClassName, className)} 
        />
      );
    }

    // If there's an error caching, fallback to the original remote URL
    const finalSrc = error ? src : cachedUrl;

    if (!finalSrc) {
      return <div className={cn("w-full h-full bg-muted", className)} />;
    }

    return (
      <video
        ref={ref}
        src={finalSrc}
        className={className}
        {...props}
      />
    );
  }
);

CachedVideo.displayName = 'CachedVideo';
