import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'user' | 'moderator' | 'admin' | 'super_admin';

interface UseAppRoleReturn {
  role: AppRole;
  isModerator: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isPrivileged: boolean; // moderator | admin | super_admin
  isInternal: boolean;   // Alias for isPrivileged
  loading: boolean;
}

/**
 * Hook to determine the current user's platform governance role.
 *
 * Role hierarchy (ascending privilege):
 *   user < moderator < admin < super_admin
 *
 * Usage:
 *   const { isModerator, isAdmin, isSuperAdmin } = useAppRole();
 */
export const useAppRole = (): UseAppRoleReturn => {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole>('user');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole('user');
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .limit(1);

        if (error) throw error;

        const fetchedRole = data && data.length > 0 ? data[0].role : null;
        console.log('[useAppRole] Fetched role for', user.id, ':', fetchedRole);
        setRole((fetchedRole as AppRole) ?? 'user');
      } catch (err) {
        console.error('[useAppRole] Error fetching role:', err);
        setRole('user');
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [user?.id]);

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
