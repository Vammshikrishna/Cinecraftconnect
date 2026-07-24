import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface CachedVideoProps extends Omit<React.VideoHTMLAttributes<HTMLVideoElement>, 'src'> {
  src?: string | null;
  skeletonClassName?: string;
}

export const CachedVideo = React.forwardRef<HTMLVideoElement, CachedVideoProps>(
  ({ src, skeletonClassName, className, onLoadedData, onError, style, ...props }, ref) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    if (!src) {
      return <div className={cn("w-full min-h-[200px] bg-muted/20", className)} />;
    }

    return (
      <div className={cn("relative overflow-hidden bg-muted/20 w-full min-h-[200px] flex items-center justify-center", skeletonClassName)}>
        {!isLoaded && !hasError && (
          <div className="absolute inset-0 bg-muted/30 animate-pulse z-0" />
        )}
        <video
          ref={ref}
          src={src}
          onLoadedData={(e) => {
            setIsLoaded(true);
            onLoadedData?.(e);
          }}
          onError={(e) => {
            setHasError(true);
            onError?.(e);
          }}
          className={cn(
            "relative z-10 transition-opacity duration-300",
            !isLoaded ? "opacity-0" : "opacity-100",
            className
          )}
          style={style}
          {...props}
        />
      </div>
    );
  }
);

CachedVideo.displayName = 'CachedVideo';
