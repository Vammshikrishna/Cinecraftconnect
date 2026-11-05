import { useState, useEffect, useRef } from 'react';

/**
 * Detects scroll direction for hide-on-scroll chrome.
 * Direction lives in refs and React state is only set when the direction actually
 * changes, so scrolling does not re-render the bars on every few pixels.
 * Rubber-band overscroll (negative or past-the-end offsets) is clamped, and
 * near the top the bars are always shown.
 */
export function useScrollDirection(threshold = 8) {
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);
  const last = useRef(0);
  const dirRef = useRef<'up' | 'down' | null>(null);
  const ticking = useRef(false);

  useEffect(() => {
    last.current = window.scrollY;
    const set = (next: 'up' | 'down') => {
      if (dirRef.current !== next) {
        dirRef.current = next;
        setDirection(next);
      }
    };
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        ticking.current = false;
        const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const y = Math.max(0, Math.min(window.scrollY, max));
        const delta = y - last.current;
        if (Math.abs(delta) <= threshold) return;
        last.current = y;
        if (y < 64) set('up');
        else set(delta > 0 ? 'down' : 'up');
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return direction;
}
