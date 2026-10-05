import { useState, useEffect } from 'react';

/**
 * React hook to cache image URLs in the browser Cache Storage API.
 * Returns a local object URL if cached/fetched successfully, or falls back to the original URL.
 */
export const useCachedImage = (url: string | null | undefined): string => {
  const [displayUrl, setDisplayUrl] = useState<string>('');
  const [checkingCache, setCheckingCache] = useState<boolean>(true);

  useEffect(() => {
    if (!url) {
      setDisplayUrl('');
      setCheckingCache(false);
      return;
    }

    // Only cache external HTTP(S) links
    if (!url.startsWith('http')) {
      setDisplayUrl(url);
      setCheckingCache(false);
      return;
    }

    // Determine if it's a Supabase URL
    // We only want to aggressively cache our own storage to prevent CORS errors on external avatars
    const isSupabaseUrl = url.includes('supabase.co');

    let isMounted = true;
    let objectUrl = '';
    setCheckingCache(true);

    const loadAndCache = async () => {
      if (!('caches' in window)) {
        if (isMounted) {
          setDisplayUrl(url);
          setCheckingCache(false);
        }
        return;
      }

      try {
        const cache = await caches.open('cinecraft-media-cache');
        const cachedResponse = await cache.match(url);

        if (cachedResponse) {
          const blob = await cachedResponse.blob();
          objectUrl = URL.createObjectURL(blob);
          if (isMounted) {
            setDisplayUrl(objectUrl);
            setCheckingCache(false);
          }
          return;
        }

        // Cache missing: display original URL first
        if (isMounted) {
          setDisplayUrl(url);
          setCheckingCache(false);
        }

        // Only fetch and store in background for our own Supabase storage
        // This prevents CORS errors on external avatars (Google, Pravatar)
        if (isSupabaseUrl) {
          const response = await fetch(url, { mode: 'cors' });
          if (response.ok) {
            await cache.put(url, response.clone());
          }
        }
      } catch (err) {
        console.debug('Background caching skipped:', url, err);
        if (isMounted) {
          setDisplayUrl(url);
          setCheckingCache(false);
        }
      }
    };

    loadAndCache();

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [url]);

  // Block loading original HTTP url while checking cache to avoid network calls
  if (checkingCache && url && url.startsWith('http')) {
    return '';
  }

  return displayUrl || url || '';
};
