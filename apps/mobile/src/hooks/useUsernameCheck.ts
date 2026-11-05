import { useEffect, useRef, useState } from 'react';
import { usernameIssue, type UsernameStatus } from '@cinecraft/core';
import { getSupabaseClient } from '@cinecraft/api';

const DEBOUNCE_MS = 500;

/**
 * Live username availability. Quiet while typing (no flashing), checks once the person pauses,
 * never shows a result for an older value, and remembers answers so retyping is instant.
 */
export const useUsernameCheck = (username: string): UsernameStatus => {
  const [status, setStatus] = useState<UsernameStatus>('idle');
  const cache = useRef(new Map<string, 'available' | 'taken'>());

  useEffect(() => {
    const issue = usernameIssue(username);
    if (issue === 'empty') { setStatus('idle'); return; }
    if (issue === 'too_short' || issue === 'reserved') { setStatus(issue); return; }
    const cached = cache.current.get(username);
    if (cached) { setStatus(cached); return; }

    setStatus('idle'); // drop a previous "Available": it belonged to a different name
    let cancelled = false;
    const timer = setTimeout(async () => {
      setStatus('checking');
      try {
        const supabase: any = getSupabaseClient();
        let available: boolean;
        const rpc = await supabase.rpc('username_available', { p_username: username });
        if (rpc.error) {
          const { data, error } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
          if (error) throw error;
          available = !data;
        } else {
          available = !!rpc.data;
        }
        if (cancelled) return;
        const result = available ? 'available' : 'taken';
        cache.current.set(username, result);
        setStatus(result);
      } catch {
        if (!cancelled) setStatus('error');
      }
    }, DEBOUNCE_MS);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [username]);

  return status;
};
