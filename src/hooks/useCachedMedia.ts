import { useState, useEffect } from 'react';

const CACHE_NAME = 'cinecraft-media-cache-v1';

// A simple in-memory map to prevent creating multiple ObjectURLs for the same media
// and to handle reference counting so we don't revoke a URL that's still in use.
const objectUrlRegistry = new Map<string, { url: string, refCount: number }>();

export const useCachedMedia = (remoteUrl: string | null | undefined) => {
  const [cachedUrl, setCachedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!remoteUrl);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    let localObjectUrl: string | null = null;

    const loadMedia = async () => {
      if (!remoteUrl) {
        setCachedUrl(null);
        setIsLoading(false);
        return;
      }

      // If it's not a remote URL (e.g., local blob, base64, or file path), just return it
      if (!remoteUrl.startsWith('http')) {
        setCachedUrl(remoteUrl);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // 1. Check if we already have an ObjectURL in memory
        if (objectUrlRegistry.has(remoteUrl)) {
          const entry = objectUrlRegistry.get(remoteUrl)!;
          entry.refCount += 1;
          localObjectUrl = entry.url;
          if (isMounted) {
            setCachedUrl(localObjectUrl);
            setIsLoading(false);
          }
          return;
        }

        // 2. Check the persistent Cache API
        const cache = await caches.open(CACHE_NAME);
        let response = await cache.match(remoteUrl);

        if (!response) {
          // 3. Not in cache, fetch it from network
          response = await fetch(remoteUrl, { mode: 'cors' });
          if (!response.ok) throw new Error('Failed to fetch media');
          
          // Store a clone in the cache for next time
          await cache.put(remoteUrl, response.clone());
        }

        // 4. Convert response to a blob and create an ObjectURL
        const blob = await response.blob();
        localObjectUrl = URL.createObjectURL(blob);

        // Register it
        objectUrlRegistry.set(remoteUrl, { url: localObjectUrl, refCount: 1 });

        if (isMounted) {
          setCachedUrl(localObjectUrl);
        }
      } catch (err: any) {
        console.error('Error caching media:', err);
        // Fallback to original URL if caching fails (e.g. CORS issues)
        if (isMounted) {
          setCachedUrl(remoteUrl);
          setError(err);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadMedia();

    // Cleanup function
    return () => {
      isMounted = false;
      if (remoteUrl && localObjectUrl && objectUrlRegistry.has(remoteUrl)) {
        const entry = objectUrlRegistry.get(remoteUrl)!;
        entry.refCount -= 1;
        
        if (entry.refCount <= 0) {
          // No more components are using this specific ObjectURL, we can free up the memory
          URL.revokeObjectURL(entry.url);
          objectUrlRegistry.delete(remoteUrl);
        }
      }
    };
  }, [remoteUrl]);

  return { cachedUrl, isLoading, error };
};
