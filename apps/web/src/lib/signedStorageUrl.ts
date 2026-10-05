import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Converts a (legacy) public Storage URL of a private bucket into a short-lived signed URL.
 * URLs that do not point at one of the given buckets are returned unchanged.
 */
export async function toSignedStorageUrl(
  url: string,
  buckets: string[] = ['pitch_assets'],
  expiresInSeconds = 300
): Promise<string> {
  for (const bucket of buckets) {
    if (url.startsWith(`${bucket}:`)) {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(url.slice(bucket.length + 1), expiresInSeconds);
      if (error || !data?.signedUrl) throw error || new Error('Could not create a signed URL');
      return data.signedUrl;
    }
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) continue;
    const path = decodeURIComponent(url.slice(idx + marker.length).split('?')[0]);
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
    if (error || !data?.signedUrl) throw error || new Error('Could not create a signed URL');
    return data.signedUrl;
  }
  return url;
}

/** React hook: resolves a stored attachment reference to a displayable (signed, if private) URL. */
export function useSignedStorageUrl(url?: string | null, buckets: string[] = ['support', 'pitch_assets']): string {
  const [resolved, setResolved] = useState('');
  useEffect(() => {
    let active = true;
    if (!url) {
      setResolved('');
      return;
    }
    toSignedStorageUrl(url, buckets, 3600)
      .then((u) => active && setResolved(u))
      .catch(() => active && setResolved(''));
    return () => {
      active = false;
    };
  }, [url]);
  return resolved;
}
