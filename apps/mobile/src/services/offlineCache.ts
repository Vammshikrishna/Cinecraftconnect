import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const CACHE_PREFIX = '@cinecraft_cache_';

// L1 High-speed In-Memory Cache for ultra-fast screen hydration (0ms lookup)
const l1MemoryCache = new Map<string, any>();

// In-memory real-time network state tracker
let isOnlineCached = true;
let cachedCurrentUserId: string | null = null;

// Restore cachedCurrentUserId from disk storage on module startup.
// getCache() awaits this so account-scoped keys are never looked up under the wrong (empty) user id at cold start.
const userIdRestored: Promise<void> = AsyncStorage.getItem(`${CACHE_PREFIX}current_user_id`).then((id) => {
  if (id && !cachedCurrentUserId) {
    cachedCurrentUserId = id;
    l1MemoryCache.set('current_user_id', id);
  }
}).catch(() => {});

// Cache entries that belong to ONE account but whose key doesn't contain the user id. They are namespaced per
// account so switching accounts shows that account's own cached data instantly (and never another account's).
const ACCOUNT_SCOPED_KEYS = new Set([
  'jobs_user_info', 'pitch_user_info', 'projects_bookmarked_map', 'user_conversations', 'user_avatar_url',
  'header_unread_notif_count', 'header_unread_msg_count', 'announcements_my_pages', 'discussion_rooms',
  'feed_posts_For You', 'network_creators', 'projects_list', 'pitch_calls_list',
]);

function scopedKeyFor(userId: string | null, key: string): string {
  if (!userId) return key;
  if (ACCOUNT_SCOPED_KEYS.has(key) || key.startsWith('widget_')) return `u:${userId}:${key}`;
  return key;
}

function scopedKey(key: string): string {
  return scopedKeyFor(cachedCurrentUserId, key);
}

/**
 * Set and cache current user id for synchronous access across screens
 */
export function setCachedCurrentUserId(id: string | null): void {
  cachedCurrentUserId = id;
  if (id) {
    l1MemoryCache.set('current_user_id', id);
    AsyncStorage.setItem(`${CACHE_PREFIX}current_user_id`, id).catch(() => {});
  } else {
    l1MemoryCache.delete('current_user_id');
    AsyncStorage.removeItem(`${CACHE_PREFIX}current_user_id`).catch(() => {});
  }
}

/**
 * Synchronously retrieve the active user ID (0ms)
 */
export function getCurrentUserIdSync(): string | null {
  return cachedCurrentUserId || (l1MemoryCache.get('current_user_id') as string) || null;
}

/**
 * Asynchronously retrieve the active user ID with full disk fallback (works 100% offline)
 */
export async function resolveCurrentUserId(): Promise<string | null> {
  if (cachedCurrentUserId) return cachedCurrentUserId;
  const inMemory = l1MemoryCache.get('current_user_id') as string | undefined;
  if (inMemory) {
    cachedCurrentUserId = inMemory;
    return inMemory;
  }
  try {
    const fromDisk = await AsyncStorage.getItem(`${CACHE_PREFIX}current_user_id`);
    if (fromDisk) {
      cachedCurrentUserId = fromDisk;
      l1MemoryCache.set('current_user_id', fromDisk);
      return fromDisk;
    }
  } catch {}
  return null;
}

/**
 * Retrieve cached data synchronously from L1 Memory (0ms)
 */
export function getCacheSync<T>(rawKey: string): T | null {
  const key = scopedKey(rawKey);
  if (l1MemoryCache.has(key)) {
    return l1MemoryCache.get(key) as T;
  }
  return null;
}

/**
 * Wraps a promise with a hard timeout to prevent hanging network calls on low bandwidth / 2G.
 */
export function withTimeout<T>(promise: Promise<T>, ms = 2500): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[NetworkTimeout] Request timed out after ${ms}ms`));
    }, ms);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Save data to L1 in-memory cache and persistent AsyncStorage cache
 */
export async function saveCache<T>(rawKey: string, data: T): Promise<void> {
  const key = scopedKey(rawKey);
  // Update L1 memory cache instantly (0ms)
  l1MemoryCache.set(key, data);

  // Defer L2 disk serialization off the synchronous execution block
  setTimeout(async () => {
    try {
      // Never write auth tokens to plain AsyncStorage: the live session already persists in the Keychain-backed
      // auth storage. Only the (non-secret) user object is kept on disk for instant offline startup.
      let diskData: any = data;
      if (rawKey === 'user_session' && data && typeof data === 'object') {
        const { access_token: _a, refresh_token: _r, provider_token: _p, provider_refresh_token: _pr, ...safe } = data as any;
        diskData = safe;
      }
      const payload = {
        timestamp: Date.now(),
        data: diskData,
      };
      await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(payload));
    } catch (e) {
      console.warn(`[offlineCache] Failed to save cache for key "${key}":`, e);
    }
  }, 0);
}

/**
 * Retrieve cached data: checks L1 memory cache first (0ms), then falls back to AsyncStorage
 */
export async function getCache<T>(rawKey: string): Promise<T | null> {
  if (!cachedCurrentUserId) await userIdRestored;
  const key = scopedKey(rawKey);
  // 1. L1 Memory Hit (Instant 0ms)
  if (l1MemoryCache.has(key)) {
    return l1MemoryCache.get(key) as T;
  }

  // 2. L2 Disk Storage Hit
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const result = (parsed?.data ?? null) as T | null;
    if (result !== null) {
      l1MemoryCache.set(key, result); // Promote to L1
    }
    return result;
  } catch (e) {
    console.warn(`[offlineCache] Failed to read cache for key "${key}":`, e);
    return null;
  }
}

/**
 * Delete a cached item from both L1 memory and AsyncStorage
 */
export async function clearCache(rawKey: string): Promise<void> {
  const key = scopedKey(rawKey);
  l1MemoryCache.delete(key);
  try {
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
  } catch (e) {
    console.warn(`[offlineCache] Failed to clear cache for key "${key}":`, e);
  }
}

/**
 * Completely wipe all L1 memory cache and all AsyncStorage cache keys (@cinecraft_cache_*)
 */
export async function clearAllOfflineCaches(): Promise<void> {
  cachedCurrentUserId = null;
  l1MemoryCache.clear();
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch (e) {
    console.warn('[offlineCache] Failed to clear all offline caches:', e);
  }
}

/**
 * Check if the device currently has network connectivity (synchronous, 0ms latency)
 */
export function isNetworkConnectedSync(): boolean {
  return isOnlineCached;
}

/**
 * Check if the device currently has network connectivity
 */
export async function isNetworkConnected(): Promise<boolean> {
  return isOnlineCached;
}

const reconnectedListeners = new Set<() => void>();
let wasOffline = false;

NetInfo.addEventListener((state) => {
  const isOnline = state.isConnected === true && state.isInternetReachable !== false;
  isOnlineCached = isOnline;

  if (wasOffline && isOnline) {
    console.log('[offlineCache] Network restored! Auto-triggering screen refresh listeners...');
    reconnectedListeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.warn('[offlineCache] Error in reconnect listener:', e);
      }
    });
  }
  wasOffline = !isOnline;
});

/**
 * Register a listener to be notified when internet connection is restored
 */
export function onNetworkReconnected(listener: () => void): () => void {
  reconnectedListeners.add(listener);
  return () => {
    reconnectedListeners.delete(listener);
  };
}

/**
 * Subscribe to network connectivity changes
 */
export function subscribeNetworkStatus(callback: (isConnected: boolean) => void): () => void {
  return NetInfo.addEventListener((state) => {
    const online = state.isConnected === true && state.isInternetReachable !== false;
    isOnlineCached = online;
    callback(online);
  });
}

/**
 * Stale-While-Revalidate pattern with L1 memory acceleration:
 * 1. Instantly loads and returns cached data from L1/disk (0ms latency).
 * 2. Fetches fresh data from network in background with non-blocking timeout.
 * 3. Saves fresh data to L1 cache & disk upon success and notifies listener.
 */
export async function fetchWithCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: {
    timeoutMs?: number;
    onCacheHit?: (cachedData: T) => void;
    onFreshData?: (freshData: T) => void;
  } = {}
): Promise<T | null> {
  const { timeoutMs = 2500, onCacheHit, onFreshData } = options;

  // Step 1: Instantly return cached data if available (L1 memory hit is synchronous)
  const cachedData = await getCache<T>(key);
  if (cachedData !== null) {
    if (onCacheHit) onCacheHit(cachedData);
  }

  // Step 2: Synchronously check internet connection (no bridge IPC delay)
  if (!isOnlineCached) {
    return cachedData;
  }

  // Step 3: Fetch fresh data with strict timeout
  try {
    const freshData = await withTimeout(fetchFn(), timeoutMs);
    if (freshData !== null && freshData !== undefined) {
      await saveCache(key, freshData);
      if (onFreshData) onFreshData(freshData);
      return freshData;
    }
  } catch (err: any) {
    console.warn(`[offlineCache] Network fetch failed or timed out for "${key}":`, err?.message || err);
  }

  return cachedData;
}

// NOTE: useAutoRefreshOnReconnect lives in hooks/useAutoRefreshOnReconnect.ts. It used to be re-exported here,
// which created an import cycle (offlineCache <-> hook) that can crash Hermes at startup
// ("Super expression must either be null or a function").

// ─── Account Switch Pre-Warming Utilities ─────────────────────────────────────

/**
 * Pre-warms the L1 in-memory cache for a SavedAccount immediately before switching.
 * This ensures ProfileScreen reads profile data from memory (0ms) instead of disk or
 * network after the root session flip.
 *
 * Called synchronously from switchToAccount() in accountManager BEFORE onSwitch().
 */
export function l1PreloadAccountCache(account: {
  userId: string;
  username: string;
  fullName: string;
  avatarUrl: string;
  accountType: string;
  email: string;
}): void {
  // Pre-warm the profile cache key used by ProfileScreen
  const skeletonProfile = {
    id: account.userId,
    username: account.username,
    full_name: account.fullName,
    avatar_url: account.avatarUrl,
    account_type: account.accountType,
    email: account.email,
    is_verified: false,
    onboarding_completed: true,
    is_banned: false,
  };
  if (!l1MemoryCache.has(`profile_${account.userId}`)) {
    l1MemoryCache.set(`profile_${account.userId}`, skeletonProfile);
  }

  // Pre-warm the avatar key read by the notification bridge
  if (account.avatarUrl) {
    l1MemoryCache.set(scopedKeyFor(account.userId, 'user_avatar_url'), account.avatarUrl);
    l1MemoryCache.set('@cinecraft_current_user_avatar', account.avatarUrl);
  }
}

/**
 * Pre-warms L1 cache for ALL saved accounts at app startup.
 * Call this once after loading @cc_saved_accounts so every account's profile
 * is immediately available in memory for instant rendering after a switch.
 */
export function warmAllSavedAccountCaches(accounts: Array<{
  userId: string;
  username: string;
  fullName: string;
  avatarUrl: string;
  accountType: string;
  email: string;
}>): void {
  for (const account of accounts) {
    // Only populate if not already in cache (avoid overwriting a freshly-fetched profile)
    if (!l1MemoryCache.has(`profile_${account.userId}`)) {
      l1MemoryCache.set(`profile_${account.userId}`, {
        id: account.userId,
        username: account.username,
        full_name: account.fullName,
        avatar_url: account.avatarUrl,
        account_type: account.accountType,
        email: account.email,
        is_verified: false,
        onboarding_completed: true,
        is_banned: false,
      });
    }
  }
}
