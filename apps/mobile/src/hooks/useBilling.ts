import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '@cinecraft/api';
import { BETA_SNAPSHOT, betaDaysLeft, canUse, limitOf, type EntitlementSnapshot } from '@cinecraft/core';

/**
 * What the signed-in person's plan includes. During the beta everything is unlocked, and if the billing part of the
 * database is missing or the call fails, this also answers "unlocked": a billing problem must never lock people out.
 */
export const useEntitlements = () => {
  const [snapshot, setSnapshot] = useState<EntitlementSnapshot>(BETA_SNAPSHOT);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data, error } = await (getSupabaseClient() as any).rpc('my_entitlements');
      setSnapshot(error || !data ? BETA_SNAPSHOT : (data as EntitlementSnapshot));
    } catch {
      setSnapshot(BETA_SNAPSHOT);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return {
    snapshot,
    loading,
    reload: load,
    isBeta: snapshot.mode === 'beta',
    betaDaysLeft: betaDaysLeft(snapshot),
    planCode: snapshot.plan ?? null,
    can: (key: string) => canUse(snapshot, key),
    limit: (key: string) => limitOf(snapshot, key),
  };
};

export interface Gift {
  id: string;
  from_name: string;
  message: string | null;
  kind: 'plan' | 'feature';
  label: string;
  feature_key: string | null;
  feature_value: unknown;
  days: number;
  status: 'sent' | 'opened' | 'accepted' | 'declined' | 'expired';
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  applied_at: string | null;
}

/** Gifts sent to the signed-in person. If the gifts part of the database is not installed yet this is an empty list. */
export const useGifts = () => {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data, error } = await (getSupabaseClient() as any).rpc('my_gifts');
      // A missing gifts function (database part not installed) still reads as "no gifts"; any other failure is an error the screen can show.
      const missing = !!error && (error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(String(error.message || '')));
      setLoadFailed(!!error && !missing);
      setGifts(error || !Array.isArray(data) ? [] : (data as Gift[]));
    } catch {
      setLoadFailed(true);
      setGifts([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const open = async (id: string) => {
    try { await (getSupabaseClient() as any).rpc('open_gift', { p_id: id }); } finally { void load(); }
  };
  const accept = async (id: string) => {
    const { data, error } = await (getSupabaseClient() as any).rpc('accept_gift', { p_id: id });
    if (error) throw error;
    void load();
    return data as { status: string; starts_when_live: boolean };
  };
  const decline = async (id: string) => {
    try {
      const { error } = await (getSupabaseClient() as any).rpc('decline_gift', { p_id: id });
      if (error) throw error;
    } finally { void load(); }
  };

  return {
    gifts,
    loading,
    loadFailed,
    reload: load,
    waiting: gifts.filter((g) => g.status === 'sent' || g.status === 'opened'),
    open,
    accept,
    decline,
  };
};

export type ProductCode = 'vendor_verification' | 'marketplace_seller';

export interface ProductAccess {
  found: boolean;
  /** true only once billing is live */
  required: boolean;
  has_access: boolean;
  valid_until?: string | null;
  uses_remaining?: number | null;
  name?: string;
  description?: string;
  billing?: 'one_time' | 'monthly' | 'yearly';
  price_minor?: number;
  currency?: string;
  is_active?: boolean;
}

// While billing is in beta, or if the call fails, nothing is required: a billing problem must never block a seller.
const OPEN: ProductAccess = { found: false, required: false, has_access: true };

/** Whether a separate paid product (business verification, marketplace seller) is needed and held. Free during the beta. */
export const useProductAccess = (code: ProductCode, subjectId?: string, enabled = true) => {
  const [access, setAccess] = useState<ProductAccess>(OPEN);
  const [buying, setBuying] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data, error } = await (getSupabaseClient() as any).rpc('my_product_access', { p_product: code, p_subject: subjectId ?? null });
      setAccess(error || !data ? OPEN : (data as ProductAccess));
    } catch {
      setAccess(OPEN);
    }
  }, [code, subjectId]);
  useEffect(() => { if (enabled) void load(); }, [enabled, load]);

  /** Starts the checkout; returns the checkout address, or a plain message when payments are not available yet. */
  const buy = async (): Promise<{ url?: string; error?: string }> => {
    setBuying(true);
    try {
      const { data, error } = await getSupabaseClient().functions.invoke('create-checkout', { body: { kind: code, subject_id: subjectId ?? null, provider: 'razorpay' } });
      if (error) throw error;
      if ((data as any)?.checkoutUrl) return { url: (data as any).checkoutUrl as string };
      return { error: (data as any)?.message || 'Payments are not available yet.' };
    } catch {
      return { error: 'Payments are not available yet.' };
    } finally {
      setBuying(false);
      void load();
    }
  };

  return { access, buying, buy, allowed: !access.required || access.has_access, needsPurchase: access.required && !access.has_access };
};
