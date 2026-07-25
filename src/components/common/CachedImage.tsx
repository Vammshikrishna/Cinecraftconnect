import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface CachedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  fallbackSrc?: string;
  skeletonClassName?: string;
}

export const CachedImage = React.forwardRef<HTMLImageElement, CachedImageProps>(
  ({ src, fallbackSrc, skeletonClassName, className, alt, onLoad, onError, style, ...props }, ref) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    if (!src && !fallbackSrc) {
      return (
        <div className={cn("w-full min-h-[200px] bg-muted/20 flex items-center justify-center rounded-lg", className)} />
      );
    }

    const finalSrc = (hasError || !src) ? (fallbackSrc || '') : src;

    return (
      <div className={cn("relative overflow-hidden bg-muted/20 w-full h-full flex items-center justify-center", skeletonClassName)}>
        {!isLoaded && !hasError && (
          <div className="absolute inset-0 bg-muted/30 animate-pulse z-0" />
        )}
        <img
          ref={ref}
          src={finalSrc}
          alt={alt || "Media"}
          loading="lazy"
          decoding="async"
          onLoad={(e) => {
            setIsLoaded(true);
            onLoad?.(e);
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

CachedImage.displayName = 'CachedImage';
