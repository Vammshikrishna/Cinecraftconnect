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

export type AppRole = 'user' | 'moderator' | 'admin' | 'super_admin';

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
        const supabase = getSupabaseClient();
        const fetchPromise = (supabase.from('user_roles') as any)
          .select('role')
          .eq('user_id', uid)
          .limit(1);

        const res: any = await withTimeout(fetchPromise, 2500);
        const data = res?.data;
        if (data && data.length > 0 && isMounted) {
          const fetchedRole = (data[0].role as AppRole) ?? 'user';
          setRole(fetchedRole);
          await saveCache(`user_role_${uid}`, fetchedRole);
        } else if (isMounted) {
          setRole('user');
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
