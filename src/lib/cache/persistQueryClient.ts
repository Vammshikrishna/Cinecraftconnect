import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

/**
 * List of query keys that are safe to persist to localStorage.
 * IMPORTANT: DO NOT add queries that contain sensitive auth tokens or PII that shouldn't be cached.
 */
const PERSISTED_QUERIES = [
  'home-feed-static',
  'home-feed-posts',
  'home-feed-ratings',
  'user-likes',
  'my-pages',
  'company-pages',
  'network-feed',
  'notifications'
];

/**
 * Initializes the React Query persister to cache UI content offline.
 * This prevents unnecessary reloading on app restart and ensures instant UI rendering.
 */
export const initPersistor = (queryClient: QueryClient) => {
  const persister = createSyncStoragePersister({
    storage: window.localStorage,
    key: 'REACT_QUERY_OFFLINE_CACHE_V1',
  });

  persistQueryClient({
    queryClient,
    persister,
    maxAge: 1000 * 60 * 60 * 24 * 3, // Persist for 3 days
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => {
        // Only persist selected safe queries that successfully fetched
        const queryKey = query.queryKey[0];
        if (typeof queryKey === 'string' && PERSISTED_QUERIES.includes(queryKey)) {
          return query.state.status === 'success';
        }
        return false;
      },
    },
  });
};

/**
 * Clears the persisted cache. Useful during logout to ensure no stale data remains.
 */
export const clearPersistedCache = () => {
  window.localStorage.removeItem('REACT_QUERY_OFFLINE_CACHE_V1');
};
