import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { friendlyError } from '@cinecraft/core';

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
  valid_days?: number;
}

// While billing is in beta, or if the call fails, nothing is required: a billing problem must never block a seller.
const OPEN: ProductAccess = { found: false, required: false, has_access: true };

/**
 * Whether a separate paid product (business verification, marketplace seller) is needed and held. Free during the beta.
 * `buy()` starts the checkout; it says so plainly when payments are not available yet.
 */
export const useProductAccess = (code: ProductCode, subjectId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [buying, setBuying] = useState(false);
  const key = ['product-access', code, subjectId ?? null, user?.id ?? 'anon'];

  const { data, isLoading } = useQuery({
    queryKey: key,
    enabled: !!user,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<ProductAccess> => {
      const { data: res, error } = await (supabase as any).rpc('my_product_access', { p_product: code, p_subject: subjectId ?? null });
      return error || !res ? OPEN : (res as ProductAccess);
    },
  });

  const access = data ?? OPEN;

  const buy = async () => {
    setBuying(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('create-checkout', { body: { kind: code, subject_id: subjectId ?? null, provider: 'razorpay' } });
      if (error) throw error;
      if ((res as any)?.checkoutUrl) {
        window.location.href = (res as any).checkoutUrl;
        return;
      }
      throw new Error((res as any)?.message || 'Payments are not available yet.');
    } catch (e) {
      toast({ title: 'Could not start the payment', description: friendlyError(e, 'Payments are not available yet.'), variant: 'destructive' });
    } finally {
      setBuying(false);
      qc.invalidateQueries({ queryKey: key });
    }
  };

  return {
    access,
    loading: isLoading,
    /** the person may go ahead (free during the beta, or the product is held) */
    allowed: !access.required || access.has_access,
    needsPurchase: access.required && !access.has_access,
    buy,
    buying,
  };
};
