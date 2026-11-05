import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { sharedFetch } from '@/lib/sharedFetch';

/** How long a role read is reused (a role change shows up within this time or on the next page load) */
const ROLE_CACHE_MS = 60_000;

export type AppRole = 'user' | 'finance' | 'moderator' | 'admin' | 'super_admin';

// finance sits between user and moderator on purpose: it is a staff account (kept out of the social side) but outranks nobody and passes no moderator check
const ROLE_RANK: Record<AppRole, number> = { user: 0, finance: 0.5, moderator: 1, admin: 2, super_admin: 3 };

/**
 * The highest-ranking role in a list of user_roles rows (super_admin > admin > moderator > user).
 * Unknown or missing values are ignored; an empty list is a normal user.
 */
export const pickHighestRole = (rows: Array<{ role?: unknown } | null | undefined> | null | undefined): AppRole => {
  let best: AppRole = 'user';
  for (const row of rows ?? []) {
    const r = row?.role;
    if (typeof r === 'string' && r in ROLE_RANK && ROLE_RANK[r as AppRole] > ROLE_RANK[best]) best = r as AppRole;
  }
  return best;
};

interface UseAppRoleReturn {
  role: AppRole;
  isModerator: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isFinance: boolean;    // the finance role (refunds only)
  isPrivileged: boolean; // finance | moderator | admin | super_admin
  isInternal: boolean;   // Alias for isPrivileged
  loading: boolean;
  /** true when the role could not be read; the role is then the safe lowest one ('user') */
  error: boolean;
}

/**
 * Hook to determine the current user's platform governance role.
 *
 * Role hierarchy (ascending privilege):
 *   user < moderator < admin < super_admin
 *
 * A person with several role rows gets the highest one. If the roles cannot be read the role stays 'user'
 * (never a staff role) and `error` is true. Nothing about the user or the role is written to the console.
 *
 * Usage:
 *   const { isModerator, isAdmin, isSuperAdmin } = useAppRole();
 */
export const useAppRole = (): UseAppRoleReturn => {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole>('user');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) {
      setRole('user');
      setError(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchRole = async () => {
      setLoading(true);
      try {
        // every component asks for the role: share one request per person instead of one per component
        const data = await sharedFetch(`user_role:${user.id}`, async () => {
          const { data: rows, error: queryError } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id);
          if (queryError) throw queryError;
          return rows;
        }, ROLE_CACHE_MS);
        if (cancelled) return;
        setRole(pickHighestRole(data as any));
        setError(false);
      } catch {
        if (cancelled) return;
        setRole('user');
        setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRole();
    return () => { cancelled = true; };
  }, [user?.id]);

  return {
    role,
    isModerator: role === 'moderator' || role === 'admin' || role === 'super_admin',
    isAdmin: role === 'admin' || role === 'super_admin',
    isSuperAdmin: role === 'super_admin',
    isFinance: role === 'finance',
    isPrivileged: role !== 'user',
    isInternal: role !== 'user',
    loading,
    error,
  };
};
