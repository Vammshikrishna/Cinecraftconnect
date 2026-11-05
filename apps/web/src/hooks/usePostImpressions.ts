import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createImpressionLogger, type ImpressionLogger } from '@cinecraft/core';

/**
 * Counts a post as seen once at least 60% of it has been on screen for a second.
 * Put the returned function as `ref` on an element that has data-post-id. Seen posts rank lower in later feeds.
 */
export function usePostImpressions(enabled: boolean) {
    const logger = useRef<ImpressionLogger | null>(null);
    const observer = useRef<IntersectionObserver | null>(null);
    const timers = useRef(new Map<Element, ReturnType<typeof setTimeout>>());

    const getObserver = () => {
        if (observer.current || typeof IntersectionObserver === 'undefined') return observer.current;
        logger.current = createImpressionLogger(supabase);
        observer.current = new IntersectionObserver((entries) => {
            for (const e of entries) {
                const id = (e.target as HTMLElement).dataset.postId;
                if (!id) continue;
                if (e.isIntersecting) {
                    if (!timers.current.has(e.target)) {
                        timers.current.set(e.target, setTimeout(() => { logger.current?.see(id); timers.current.delete(e.target); }, 1000));
                    }
                } else {
                    const t = timers.current.get(e.target);
                    if (t) { clearTimeout(t); timers.current.delete(e.target); }
                }
            }
        }, { threshold: 0.6 });
        return observer.current;
    };

    useEffect(() => {
        if (!enabled) return;
        const onHide = () => { if (document.visibilityState === 'hidden') void logger.current?.flush(); };
        document.addEventListener('visibilitychange', onHide);
        return () => {
            document.removeEventListener('visibilitychange', onHide);
            void logger.current?.flush();
            logger.current?.stop();
            observer.current?.disconnect();
            timers.current.forEach((t) => clearTimeout(t));
            timers.current.clear();
            observer.current = null;
            logger.current = null;
        };
    }, [enabled]);

    return useCallback((el: HTMLElement | null) => {
        if (!el || !enabled) return;
        getObserver()?.observe(el);
    }, [enabled]);
}
