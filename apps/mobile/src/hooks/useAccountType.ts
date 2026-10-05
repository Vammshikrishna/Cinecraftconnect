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

export type AccountType = 'fan' | 'creator' | 'studio';

export interface UseAccountTypeReturn {
  accountType: AccountType;
  isFan: boolean;
  isCreator: boolean;
  isStudio: boolean;
  isPro: boolean;
  loading: boolean;
}

/**
 * Hook to determine the current user's account type in Mobile.
 *
 * - `isFan`      → true when account_type === 'fan'
 * - `isCreator`  → true when account_type === 'creator'
 * - `isStudio`   → true when account_type === 'studio'
 * - `isPro`      → true for 'creator' or 'studio'
 * - `accountType`→ raw value ('fan' | 'creator' | 'studio')
 *
 * Legacy profiles without account_type default to 'creator'.
 */
export const useAccountType = (): UseAccountTypeReturn => {
  const [accountType, setAccountType] = useState<AccountType>(() => {
    const uid = getCurrentUserIdSync();
    if (uid) {
      const cached = getCacheSync<any>(`profile_${uid}`);
      if (cached?.account_type) {
        return cached.account_type === 'fan'
          ? 'fan'
          : cached.account_type === 'studio'
          ? 'studio'
          : 'creator';
      }
    }
    return 'creator';
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchAccountType = async () => {
      const uid = await resolveCurrentUserId();
      if (!uid) {
        if (isMounted) {
          setAccountType('creator');
          setLoading(false);
        }
        return;
      }

      // Check cache first (0ms)
      const cached = await getCache<any>(`profile_${uid}`);
      if (cached?.account_type && isMounted) {
        const raw = cached.account_type;
        const resolved: AccountType =
          raw === 'fan' ? 'fan' : raw === 'studio' ? 'studio' : 'creator';
        setAccountType(resolved);
        setLoading(false);
      }

      // Fetch fresh from Supabase in background
      try {
        const supabase = getSupabaseClient();
        const fetchPromise = (supabase.from('profiles') as any)
          .select('account_type')
          .eq('id', uid)
          .maybeSingle();

        const res: any = await withTimeout(fetchPromise, 2500);
        const data = res?.data;
        if (data && isMounted) {
          const raw = data.account_type;
          const resolved: AccountType =
            raw === 'fan' ? 'fan' : raw === 'studio' ? 'studio' : 'creator';
          setAccountType(resolved);
          if (cached) {
            await saveCache(`profile_${uid}`, { ...cached, account_type: resolved });
          }
        }
      } catch (err) {
        // Offline / timeout, retain cached value
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAccountType();

    // Listen to realtime profile updates
    const uid = getCurrentUserIdSync();
    let channel: any = null;
    if (uid) {
      try {
        const supabase = getSupabaseClient();
        channel = supabase
          .channel(`profile_account_type_${uid}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` },
            (payload: any) => {
              if (payload.new?.account_type && isMounted) {
                const raw = payload.new.account_type;
                const resolved: AccountType =
                  raw === 'fan' ? 'fan' : raw === 'studio' ? 'studio' : 'creator';
                setAccountType(resolved);
              }
            }
          )
          .subscribe();
      } catch {}
    }

    return () => {
      isMounted = false;
      if (channel) {
        try {
          const supabase = getSupabaseClient();
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, []);

  return {
    accountType,
    isFan: accountType === 'fan',
    isCreator: accountType === 'creator',
    isStudio: accountType === 'studio',
    isPro: accountType === 'creator' || accountType === 'studio',
    loading,
  };
};

export default useAccountType;
