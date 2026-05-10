import { useState, useEffect } from 'react';

/**
 * Hook to detect scroll direction.
 * Returns 'up' when scrolling up, 'down' when scrolling down.
 */
export function useScrollDirection() {
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);
  const [prevOffset, setPrevOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentOffset = window.pageYOffset;
      const diff = currentOffset - prevOffset;

      // Only change direction if we've scrolled more than a threshold (e.g. 5px)
      if (Math.abs(diff) > 5) {
        setScrollDirection(diff > 0 ? 'down' : 'up');
        setPrevOffset(currentOffset);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [prevOffset]);

  return scrollDirection;
}
