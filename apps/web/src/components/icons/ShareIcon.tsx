import React from 'react';
import shareArtwork from '@/assets/share-icon.png';
import { cn } from '@/lib/utils';

interface ShareIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** px, like the lucide icons this replaces; className (h-4 w-4 ...) works too */
  size?: number;
}

/**
 * The app's share icon: the same paper-plane artwork the mobile app uses.
 * It is drawn in the current text colour, so it follows light/dark and hover colours like any other icon.
 */
export const ShareIcon = ({ className, style, size, ...rest }: ShareIconProps) => {
  const mask = `url(${shareArtwork})`;
  return (
    <span
      aria-hidden="true"
      {...rest}
      className={cn('inline-block shrink-0 bg-current', !size && 'h-4 w-4', className)}
      style={{
        WebkitMaskImage: mask,
        maskImage: mask,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        ...(size ? { width: size, height: size } : null),
        ...style,
      }}
    />
  );
};

export default ShareIcon;
