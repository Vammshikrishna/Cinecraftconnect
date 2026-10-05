import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface BlockedUser {
  blocked_user_id: string;
  created_at: string;
  profile?: { id: string; username: string | null; full_name: string | null; avatar_url: string | null } | null;
}

/** Blocking is enforced in the database for direct messages (both directions). */
export function useBlockedUsers() {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setBlocked([]);
      setLoading(false);
      return;
    }
    const { data } = await (supabase as any)
      .from('blocked_users')
      .select('blocked_user_id, created_at, profile:blocked_user_id(id, username, full_name, avatar_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setBlocked((data as BlockedUser[]) || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isBlocked = useCallback(
    (targetId: string) => blocked.some((b) => b.blocked_user_id === targetId),
    [blocked]
  );

  const block = useCallback(
    async (targetId: string) => {
      if (!user) return { error: new Error('Sign in required') };
      const { error } = await (supabase as any)
        .from('blocked_users')
        .insert({ user_id: user.id, blocked_user_id: targetId });
      if (!error || (error as any).code === '23505') {
        await refresh();
        return { error: null };
      }
      return { error };
    },
    [user?.id, refresh]
  );

  const unblock = useCallback(
    async (targetId: string) => {
      if (!user) return { error: new Error('Sign in required') };
      const { error } = await (supabase as any)
        .from('blocked_users')
        .delete()
        .eq('user_id', user.id)
        .eq('blocked_user_id', targetId);
      if (!error) await refresh();
      return { error };
    },
    [user?.id, refresh]
  );

  return { blocked, loading, isBlocked, block, unblock, refresh };
}
