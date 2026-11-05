import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@cinecraft/api';
import {
  getCache,
  getCacheSync,
  saveCache,
  getCurrentUserIdSync,
  resolveCurrentUserId,
  withTimeout,
} from '../services/offlineCache';
import { sharedFetch } from '../utils/sharedFetch';

export type AppRole = 'user' | 'moderator' | 'admin' | 'super_admin';

const ROLE_RANK: Record<AppRole, number> = { user: 0, moderator: 1, admin: 2, super_admin: 3 };

/** The highest-ranking role in a list of user_roles rows (super_admin > admin > moderator > user). */
export const pickHighestRole = (rows: Array<{ role?: unknown } | null | undefined> | null | undefined): AppRole => {
  let best: AppRole = 'user';
  for (const row of rows ?? []) {
    const r = row?.role;
    if (typeof r === 'string' && r in ROLE_RANK && ROLE_RANK[r as AppRole] > ROLE_RANK[best]) best = r as AppRole;
  }
  return best;
};

export interface UseAppRoleReturn {
  role: AppRole;
  isModerator: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isPrivileged: boolean; // moderator | admin | super_admin
  isInternal: boolean;   // Alias for isPrivileged
  loading: boolean;
}

/**
 * Hook to determine the current user's platform governance role in Mobile.
 *
 * Role hierarchy (ascending privilege):
 *   user < moderator < admin < super_admin
 */
export const useAppRole = (): UseAppRoleReturn => {
  const [role, setRole] = useState<AppRole>(() => {
    const uid = getCurrentUserIdSync();
    if (uid) {
      const cached = getCacheSync<AppRole>(`user_role_${uid}`);
      if (cached) return cached;
    }
    return 'user';
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchRole = async () => {
      const uid = await resolveCurrentUserId();
      if (!uid) {
        if (isMounted) {
          setRole('user');
          setLoading(false);
        }
        return;
      }

      // 0ms Cache Lookup
      const cached = await getCache<AppRole>(`user_role_${uid}`);
      if (cached && isMounted) {
        setRole(cached);
        setLoading(false);
      }

      try {
        // every screen asks for the role: share one request per person instead of one per screen
        const data = await sharedFetch(`user_role:${uid}`, async () => {
          const supabase = getSupabaseClient();
          const fetchPromise = (supabase.from('user_roles') as any)
            .select('role')
            .eq('user_id', uid);
          const res: any = await withTimeout(fetchPromise, 2500);
          if (res?.error) throw res.error; // keep the cached role; never grant one from a failed read
          return res?.data;
        }, 60_000);
        if (isMounted) {
          // several role rows: take the highest-ranking one
          const fetchedRole = pickHighestRole(data);
          setRole(fetchedRole);
          await saveCache(`user_role_${uid}`, fetchedRole);
        }
      } catch (err) {
        // Retain cached role on timeout/offline
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRole();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    role,
    isModerator: role === 'moderator' || role === 'admin' || role === 'super_admin',
    isAdmin: role === 'admin' || role === 'super_admin',
    isSuperAdmin: role === 'super_admin',
    isPrivileged: role !== 'user',
    isInternal: role !== 'user',
    loading,
  };
};

export default useAppRole;
