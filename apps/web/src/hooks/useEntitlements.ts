import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BETA_SNAPSHOT, betaDaysLeft, canUse, limitOf, remainingUnder, type EntitlementKey, type EntitlementSnapshot } from '@cinecraft/core';

/**
 * What the signed-in person's plan includes.
 *
 * During the beta everything is unlocked, and if the billing part of the database is not installed yet, or the call
 * fails for any reason, this also answers "unlocked": a billing problem must never lock people out of the app.
 */
export const useEntitlements = () => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['entitlements', user?.id ?? 'anon'],
    queryFn: async (): Promise<EntitlementSnapshot> => {
      const { data: snap, error } = await (supabase as any).rpc('my_entitlements');
      if (error || !snap) return BETA_SNAPSHOT;
      return snap as EntitlementSnapshot;
    },
    staleTime: 60_000,
    retry: false,
  });

  const snapshot = data ?? BETA_SNAPSHOT;

  return {
    snapshot,
    loading: isLoading,
    isBeta: snapshot.mode === 'beta',
    betaDaysLeft: betaDaysLeft(snapshot),
    planCode: snapshot.plan ?? null,
    /** may this person use the feature? */
    can: (key: EntitlementKey | string) => canUse(snapshot, key),
    /** the most they may have (null = no limit) */
    limit: (key: EntitlementKey | string) => limitOf(snapshot, key),
    /** how many more they may add, given how many they have (null = no limit) */
    remaining: (key: EntitlementKey | string, used: number) => remainingUnder(snapshot, key, used),
  };
};
