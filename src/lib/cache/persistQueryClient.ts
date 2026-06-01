import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createIdbPersister } from './idbPersister';

/**
 * Cache key versioned so stale blobs are automatically discarded on upgrade.
 * Bump this string whenever the shape of persisted data changes in a
 * backwards-incompatible way (e.g. a query key rename or type change).
 */
const CACHE_KEY = 'cinecraft-production-cache-v1';

/**
 * Query keys that are safe to persist to IndexedDB.
 *
 * IMPORTANT: Never add queries that contain:
 *   - Auth tokens / session data
 *   - PII that must not survive a browser restart
 *   - Rapidly-changing transient state (e.g. presence, typing indicators)
 *
 * Production data (tasks, budget, call sheets) is safe because:
 *   - It is project-scoped (per projectId)
 *   - It is fetched fresh on mount when online
 *   - When offline the user expects to see their last-known state
 */
const PERSISTED_QUERIES: string[] = [
  // ── Home feed ────────────────────────────────────────────────────────────
  'home-feed-static',
  'home-feed-posts',
  'home-feed-ratings',
  'user-likes',
  'my-pages',
  'company-pages',
  'network-feed',
  'notifications',

  // ── Production workspace ─────────────────────────────────────────────────
  'project-tasks',       // Tasks.tsx  →  useProjectTasks
  'project-budget',      // BudgetSched.tsx  →  useProjectBudget
  'project-schedule',    // BudgetSched.tsx  →  useProjectBudget
  'project-call-sheets', // CallSheet.tsx  →  useProjectCallSheets
];

/**
 * Initializes React Query persistence to IndexedDB.
 *
 * Uses an async persister (IndexedDB) instead of the previous synchronous
 * localStorage persister for three key reasons:
 *   1. Async I/O — never blocks the main thread during cache restore/write
 *   2. Capacity — IndexedDB supports 50–500 MB vs localStorage's ~5 MB cap
 *   3. Production data can be large (call sheets, budget breakdowns)
 */
export const initPersistor = (queryClient: QueryClient) => {
  const persister = createIdbPersister(CACHE_KEY);

  persistQueryClient({
    queryClient,
    persister,
    maxAge: 1000 * 60 * 60 * 24 * 3, // Persist for 3 days
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => {
        // Only persist explicitly allow-listed, successfully-fetched queries
        const queryKey = query.queryKey[0];
        return (
          typeof queryKey === 'string' &&
          PERSISTED_QUERIES.includes(queryKey) &&
          query.state.status === 'success'
        );
      },
    },
  });
};

/**
 * Wipes the IndexedDB cache entry.
 * Call this during logout to prevent stale project data from leaking
 * to the next authenticated user on the same device.
 */
export const clearPersistedCache = async (): Promise<void> => {
  const persister = createIdbPersister(CACHE_KEY);
  await persister.removeClient();
};
