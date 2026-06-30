import React from 'react';
import { useCachedMedia } from '@/hooks/useCachedMedia';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface CachedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  fallbackSrc?: string;
  skeletonClassName?: string;
}

export const CachedImage = React.forwardRef<HTMLImageElement, CachedImageProps>(
  ({ src, fallbackSrc, skeletonClassName, className, alt, ...props }, ref) => {
    const { cachedUrl, isLoading, error } = useCachedMedia(src);

    if (isLoading) {
      return (
        <Skeleton 
          className={cn("w-full h-full bg-muted animate-pulse", skeletonClassName, className)} 
        />
      );
    }

    const finalSrc = error || !cachedUrl ? fallbackSrc : cachedUrl;

    if (!finalSrc) {
        // Render a placeholder or empty div if no src and no fallback
        return <div className={cn("w-full h-full bg-muted flex items-center justify-center", className)} />;
    }

    return (
      <img
        ref={ref}
        src={finalSrc}
        alt={alt || "Media"}
        className={className}
        {...props}
      />
    );
  }
);

CachedImage.displayName = 'CachedImage';
