import { useCallback, useRef, useState } from 'react';

export const PAGE_SIZE = 25;

/**
 * Paging state shared by the list screens (same pattern as Jobs):
 * - `resetPaging(count)` is called when page 1 arrives (first load, refresh, new search/filter/tab).
 *   It sets `hasMore` from the row count and invalidates any "load more" still in flight.
 * - `loadMore(offset, fetchRange, setItems)` fetches the next PAGE_SIZE rows, appends them without
 *   duplicates, and is ignored while another page is loading or when there is nothing more.
 * `fetchRange(from, to)` must return the rows and THROW on a query error.
 */
export function usePagedList<T extends { id?: any }>() {
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const busyRef = useRef(false);
  const hasMoreRef = useRef(true);
  const genRef = useRef(0);

  const resetPaging = useCallback((firstPageCount: number) => {
    genRef.current += 1;
    busyRef.current = false;
    setLoadingMore(false);
    const more = firstPageCount >= PAGE_SIZE;
    hasMoreRef.current = more;
    setHasMore(more);
  }, []);

  const loadMore = useCallback(
    async (
      offset: number,
      fetchRange: (from: number, to: number) => Promise<T[]>,
      setItems: (updater: (prev: T[]) => T[]) => void,
    ) => {
      if (busyRef.current || !hasMoreRef.current || offset === 0) return;
      busyRef.current = true;
      const gen = genRef.current;
      setLoadingMore(true);
      try {
        const rows = await fetchRange(offset, offset + PAGE_SIZE - 1);
        if (gen !== genRef.current) return; // a newer page 1 replaced the list meanwhile
        setItems((prev) => {
          const seen = new Set(prev.map((r) => r.id));
          return [...prev, ...rows.filter((r) => !seen.has(r.id))];
        });
        if (rows.length < PAGE_SIZE) {
          hasMoreRef.current = false;
          setHasMore(false);
        }
      } catch (e) {
        console.warn('[usePagedList] Error loading more:', e);
      } finally {
        if (gen === genRef.current) {
          busyRef.current = false;
          setLoadingMore(false);
        }
      }
    },
    [],
  );

  return { hasMore, loadingMore, loadMore, resetPaging };
}
