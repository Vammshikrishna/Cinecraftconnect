import { useEffect, useRef, useState } from 'react';
import { usernameIssue, type UsernameStatus } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';

const DEBOUNCE_MS = 500;

/**
 * Live username availability. Quiet while typing (no flashing), checks once the person pauses,
 * never shows a result for an older value, and remembers answers so retyping is instant.
 */
export const useUsernameCheck = (username: string) => {
  const [status, setStatus] = useState<UsernameStatus>('idle');
  const cache = useRef(new Map<string, 'available' | 'taken'>());

  useEffect(() => {
    const issue = usernameIssue(username);
    if (issue === 'empty') { setStatus('idle'); return; }
    if (issue === 'too_short' || issue === 'reserved') { setStatus(issue); return; }
    const cached = cache.current.get(username);
    if (cached) { setStatus(cached); return; }

    setStatus('idle'); // drop any previous "Available" right away: it belonged to a different name
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setStatus('checking');
      try {
        let available: boolean;
        const rpc = await (supabase as any).rpc('username_available', { p_username: username });
        if (rpc.error) {
          // function not deployed yet: fall back to a direct lookup
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

    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [username]);

  return status;
};
