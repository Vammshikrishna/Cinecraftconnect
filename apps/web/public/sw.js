/**
 * SERVICE WORKER — CineCraft Connect
 * 
 * STRATEGY: Instagram-grade Cache-First for static assets & images.
 * Optimized for Supabase storage transformations.
 */

const SHELL_CACHE = 'cinecraft-shell-v3';
const IMAGE_CACHE = 'cinecraft-images-v2';
const API_CACHE = 'cinecraft-api-v2';

const IMAGE_CACHE_MAX = 300;           // Increased for better retention
const IMAGE_TTL_MS = 14 * 24 * 60 * 60 * 1000;  // 14 days
const API_TTL_MS   =  10 * 60 * 1000;            // 10 minutes

const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
];

// ─── Install ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS))
  );
  // @ts-ignore
  self.skipWaiting();
});

// ─── Activate ────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const valid = new Set([SHELL_CACHE, IMAGE_CACHE, API_CACHE]);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !valid.has(k)).map((k) => caches.delete(k)))
    )
  );
  // @ts-ignore
  self.clients.claim();
});

// ─── Periodic Background Sync ────────────────────────────────────────────────
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-feed') {
    console.log('[SW] Periodic Sync: Fetching fresh feed data...');
    event.waitUntil(fetchAndCacheFeed());
  }
});

async function fetchAndCacheFeed() {
  const cache = await caches.open(API_CACHE);
  try {
    // Attempt to pre-warm the feed API
    const response = await fetch('/rest/v1/posts?select=*&order=created_at.desc&limit=10');
    if (response.ok) {
      const clone = response.clone();
      const headers = new Headers(clone.headers);
      headers.set('sw-cached-at', String(Date.now()));
      cache.put('/rest/v1/posts?select=*&order=created_at.desc&limit=10', new Response(await clone.arrayBuffer(), { headers }));
    }
  } catch (err) {
    console.error('[SW] Periodic sync failed:', err);
  }
}

// ─── Fetch ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  if (request.headers.has('range') || isVideoOrAudioRequest(request, url)) return; // Bypass SW for streaming media and range requests

  // Normalize URL for caching (ignore query param order for Supabase images)
  const normalizedUrl = normalizeMediaUrl(url);

  // 1. Image / media → Cache-First
  if (isMediaRequest(url) || (url.hostname.includes('supabase') && url.pathname.includes('/storage/'))) {
    event.respondWith(cacheFirstMedia(request, normalizedUrl));
    return;
  }

  // 2. Supabase REST API → Network-First
  if (url.hostname.includes('supabase') && url.pathname.includes('/rest/')) {
    event.respondWith(networkFirstAPI(request));
    return;
  }

  // 3. App Shell → Stale-While-Revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// ─── Strategies ──────────────────────────────────────────────────────────────

async function cacheFirstMedia(request, normalizedUrl) {
  const cache = await caches.open(IMAGE_CACHE);
  // Try matching with normalized URL first
  const cached = await cache.match(normalizedUrl || request);

  if (cached) {
    const dateHeader = cached.headers.get('sw-cached-at');
    if (dateHeader) {
      const age = Date.now() - parseInt(dateHeader, 10);
      if (age < IMAGE_TTL_MS) return cached;
    } else {
      return cached;
    }
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const headers = new Headers(response.headers);
      headers.set('sw-cached-at', String(Date.now()));
      const clone = new Response(await response.clone().arrayBuffer(), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      await evictIfNeeded(cache, IMAGE_CACHE_MAX);
      // Cache under the normalized URL to avoid duplicate entries for same image with diff param order
      cache.put(normalizedUrl || request, clone);
    }
    return response;
  } catch {
    return cached || new Response('', { status: 503 });
  }
}

async function networkFirstAPI(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      const headers = new Headers(response.headers);
      headers.set('sw-cached-at', String(Date.now()));
      const clone = new Response(await response.clone().arrayBuffer(), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      cache.put(request, clone);
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      const age = Date.now() - parseInt(cached.headers.get('sw-cached-at') || '0', 10);
      if (age < API_TTL_MS) return cached;
    }
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  
  // Don't cache data/api requests in shell cache
  const url = new URL(request.url);
  if (url.pathname.includes('/api/')) return fetch(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok && response.type === 'basic') cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  
  return cached || fetchPromise;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isVideoOrAudioRequest(request, url) {
  const isVideoExtension = /\.(mp4|webm|mov|m4a|mp3|wav|ogg|aac|avi|mkv|flac)(\?.*)?$/i.test(url.pathname);
  const isVideoDestination = request.destination === 'video' || request.destination === 'audio';
  return isVideoExtension || isVideoDestination;
}

function isMediaRequest(url) {
  return /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?.*)?$/i.test(url.pathname);
}

/** Normalizes Supabase storage URLs by sorting query parameters alphabetically */
function normalizeMediaUrl(url) {
  const isSupabaseStorage = url.hostname.includes('supabase') && url.pathname.includes('/storage/');
  if (!isSupabaseStorage) return null;
  
  const searchParams = new URLSearchParams(url.search);
  searchParams.sort();
  // We keep all parameters but ensure they are sorted for consistent cache keys
  return `${url.origin}${url.pathname}?${searchParams.toString()}`;
}

async function evictIfNeeded(cache, maxItems) {
  const keys = await cache.keys();
  if (keys.length >= maxItems) {
    const toDelete = keys.slice(0, Math.ceil(maxItems * 0.2));
    await Promise.all(toDelete.map((k) => cache.delete(k)));
  }
}
